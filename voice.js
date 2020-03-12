const CryptoJS = require('crypto-js')
const WebSocket = require('ws')
var log = require('log4node')
const mp3FilePath = require('./const').mp3FilePath
const resUrl = require('./const').resUrl
const fs = require('fs')


function createVoice(req, res) {
  // 获取要合成的文字，文字不超过1000
  const text = req.query.text
  // 语言
  const lang = req.query.lang
  // const text = '却无法少的高度发送给'
  // const lang = 'cn'
  // 引擎类型
  let engineType = 'intp65'
  if (lang.toLowerCase() === 'en') {
    engineType = 'intp65_en'
  }
// 系统配置
  const config = {
    // 请求地址
    hostUrl: "wss://tts-api.xfyun.cn/v2/tts",
    host: "tts-api.xfyun.cn",
    //在控制台-我的应用-在线语音合成（流式版）获取
    appid: "5e6994e7",
    //在控制台-我的应用-在线语音合成（流式版）获取
    apiSecret: "37b4dced30af415618b049edd7ab585d",
    //在控制台-我的应用-在线语音合成（流式版）获取
    apiKey: "9af84aa0ece62b537270e1078c594bd3",
    text: text,
    uri: "/v2/tts",
  }

// 获取当前时间 RFC1123格式
  let date = (new Date().toUTCString())
// 设置当前临时状态为初始化

  let wssUrl = config.hostUrl + "?authorization=" + getAuthStr(date) + "&date=" + date + "&host=" + config.host
  // 将要访问的地址传入 实例化websocket,发起请求
  let ws = new WebSocket(wssUrl)

// 连接建立完毕，执行回调
  ws.on('open', () => {
    // 日志打印
    log.info("websocket connect!")
    // 发送二进制数据
    send()
  })

// 得到结果后进行处理，仅供参考，具体业务具体对待
  ws.on('message', (data, err) => {
    // 访问错误，打印错误日志
    if (err) {
      log.error('message error: ' + err)
      res.json({
        error: 1,
        msg: '下载失败'
      })
      return
    }
    // 解析语音合成接口返回的数据并保存
    let resObj = JSON.parse(data)
    // 数据状态不为0则证明错误
    if (resObj.code != 0) {
      log.error(`${resObj.code}: ${resObj.message}`)
      res.json({
        error: 1,
        msg: '下载失败'
      })
      ws.close()
      return
    }
    // 当code为0 data.status为2 证明传输完成 关闭连接
    if (resObj.code == 0 && resObj.data.status == 2) {
      let audio = resObj.data.audio
      let audioBuf = Buffer.from(audio, 'base64')
      // mp3文件会根据以这里获取的时间命名
      const fileName = new Date().getTime()
      // mp3文件保存的本地路径
      const filePath = `${mp3FilePath}/${fileName}.mp3`
      // 实际下载的路径(nginx的路径)
      const downloadUrl = `${resUrl}/mp3/${fileName}.mp3`
      // 保存文件
      save(audioBuf, filePath, downloadUrl)
      // 关闭链接，因为下方对关闭链接后的回调进行了处理，所以也会打印日志
      ws.close()
    }
  })

// 资源释放
  ws.on('close', () => {
    log.info('connect close!')
  })

// 连接错误
  ws.on('error', (err) => {
    log.error("websocket connect err: " + err)
  })

// 鉴权签名
  function getAuthStr(date) {
    let signatureOrigin = `host: ${config.host}\ndate: ${date}\nGET ${config.uri} HTTP/1.1`
    let signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret)
    let signature = CryptoJS.enc.Base64.stringify(signatureSha)
    let authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
    let authStr = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(authorizationOrigin))
    return authStr
  }

// 传输数据
  function send() {
    let frame = {
      // 填充common
      "common": {
        "app_id": config.appid
      },
      // 填充business
      "business": {
        // 音频编码，专用于mp3格式
        "aue": "lame",
        "auf": "audio/L16;rate=16000",
        "vcn": "aisxping",
        "tte": "UTF8",
        "ent": engineType
      },
      // 填充data
      "data": {
        "text": Buffer.from(config.text).toString('base64'),
        "status": 2
      }
    }
    // 像服务器发送二进制数据
    ws.send(JSON.stringify(frame))
  }

// 保存文件
  function save(data, filePath, downloadUrl) {
    fs.writeFile(filePath, data, (err) => {
      if (err) {
        log.error('save error: ' + err)
        res.json({
          error: 1,
          msg: '下载失败'
        })
        return
      }
      log.info('文件保存成功')
      // 成功则证明操作成功，返回下载路径，供前台下载
      res.json({
        error: 0,
        msg: '下载成功',
        path: downloadUrl
      })
    })
  }
}
module.exports = createVoice

