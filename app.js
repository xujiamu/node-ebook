const express = require('express')
const mysql = require('mysql')
const constant = require('./const')
const cors = require('cors')
const voice = require('./voice')

const app = express()
app.use(cors())

app.get('/', (req, res) => {
  res.send(new Date().toDateString())
})
// 连接数据库
function connect() {
  // 创建连接，传入配置信息
  return mysql.createConnection({
    host: constant.dbHost,
    user: constant.dbUser,
    // 密码需要字符串形式传入
    password: constant.dbPwd,
    // 数据库名称
    database: 'book'
  })
}

app.get('/book/test', (req, res) => {
  // 调用connect方法连接数据库,方法会返回对象，可以调用该对象中的方法进行查询
  const conn = connect()
  // 调用query方法.输入查询语句,并通过箭头函接收结果
  conn.query('select * from book', (err, results) => {
    if (err) {
      // res.json 与 res.send类似，都是express中后台向前面发送数据的方法，区别是
      // res.json类似于能够将数据转为json格式，类似于 JONS.stringify的功能
      // 这里如果获取获取数据库信息失败，则传入如下对象，err_code代表状态码，我们用
      // 1表示失败，0表示成功，并且前台可以读取 msg(错误信息)，显示在界面上
      res.json({
        err_code: 1,
        msg: '数据库查询失败'
      })
    } else {
      res.json({
        err_code: 0,
        data: results
      })
    }
    // 关闭数据库
    conn.end()
  })
})

// n 需要书的数量， l 书的总数
function randomArray(n, l) {
  let rnd = []
  for(let i = 0; i < n; i++) {
    // 将取到的随机书的位置传入rnd 位置包括左边界0，但不不包括右边界 l
    rnd.push(Math.floor(Math.random() * l))
  }
  return rnd
}


// result为图书数据 key为对应索引
function createData(results, key) {
  // 返回经过简单处理的随机一本书
  return handleData(results[key])

}

function handleData(data) {
  // 因为封面保存在数据库中的路径是相对路径，所以不能直接使用需要对路径进行处理
  // 这里进行判断只要封面的路径不是http开头，就进行路径处理，因为该方法会多次调用，所以进行if判断，避免多余的重新赋值
  if (!data.cover.startsWith('http://')) {
    // 图书封面url的设置
    data['cover'] = `${constant.resUrl}/img${data.cover}`
  }
  // 增加一些默认属性
  data['selected'] = false // 是否选中
  data['private'] = false // 是否私密
  data['cache'] = false // 是否缓存
  data['haveRead'] = 0 // 阅读状态
  return data
}

function createGuessYouLike(data) {
  // n 代表从 1到3之间取随机数，包括边界1,3
  const n = parseInt(randomArray(1, 3)) + 1
  // 下面的内容就是根据模拟的n值赋予每本书的关联信息，前台会利用这些关联信息渲染不同的文字
  data['type'] = n
  switch (n) {
    case 1:
      data['result'] = data.id % 2 === 0 ? '《Executing Magic》' : '《Elements of Robotics》'
      break
    case 2:
      data['result'] = data.id % 2 === 0 ? '《Improving Psychiatric Care》' : '《Programming Languages》'
      break
    case 3:
      data['result'] =  '《Living with Disfigurement》'
      data['percent'] = data.id % 2 === 0 ? '92%' : '97%'
      break
  }
  return data
}

function createCategoryIds(n) {
  // arr 用来保存所有分类的位置
  const arr = []
  constant.category.forEach((item, index) => {
    arr.push(index + 1)
  })
  // result用来保存最终结果
  const result = []
  // 循环遍历n次
  for (let i = 0; i < n; i++) {
    // 要求：获取的随机数不能重复
    // 范围为0至arr.length-i个，由于没有加1，所以不包括最后一个
    // 是因为最后一步中用最后一位数替代了获取的随机数，这里减i能在新的随机数中排除那一位，避免最后一位随到的概率增大
    const ran = Math.floor(Math.random() * (arr.length - i))
    // 获取分类对应的序号
    result.push(arr[ran])
    // 将已经获取的随机数取代，用最后一位数
    arr[ran] = arr[arr.length - i - 1]
  }
  return result
}

function createCategoryData(data) {
  // 获得指定数量的随机分类序号
  const categoryIds = createCategoryIds(6)
  // 用于保存最终结果
  const result = []
  // 遍历分类序号
  categoryIds.forEach(categoryId => {
    // 将数据进行过滤（条件为分类序号相同），将相同的前4本保存
    const subList = data.filter(item => item.category === categoryId).slice(0, 4)
    // 再次遍历调用并调用handleData，为数据对象添加属性，更新封面链接
    subList.map(item => {
      return handleData(item)
    })
    // 将由序号和图书数据对象组成的对象加入数组
    result.push({
      category: categoryId,
      list: subList
    })
  })
  // 因为有的分类可能不足四本书，所以再次过滤，将确定等于四本书的对象存入数组，并返回
  return result.filter(item => item.list.length === 4)
}

function createRecommendData(data) {
  // 推荐图书随机取阅读人数
  data['readers'] = Math.floor(data.id / 2 * randomArray(1, 100))
  return data
}
// 首页数据接口
app.get('/book/home', (req, res) => {
  const conn = connect()
  // 查询所有封面不为空的图书
  conn.query('select * from book where cover != \'\'', (err, results) => {
    // 图书数量
    const length = results.length
    // 猜你喜欢
    const guessYouLike = []
    // 首页封面图
    const banner = constant.resUrl + '/home_banner2.jpg'
    // 推荐图书
    const recommend = []
    // 精选
    const featured = []
    // 随机图书
    const random = []
    // 分类列表 由于目前的分类是固定的，所以这里不在数据库中建立表，直接在const.js中创建分类数组
    const categoryList = createCategoryData(results)
    // 详细分类 包含每一个分类的顺序，图书数量，以及两张封面图片地址
    const categories = [
      {
        category: 1,
        num: 56,
        img1: constant.resUrl + '/cover/cs/A978-3-319-62533-1_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/cs/A978-3-319-89366-2_CoverFigure.jpg'
      },
      {
        category: 2,
        num: 51,
        img1: constant.resUrl + '/cover/ss/A978-3-319-61291-1_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/ss/A978-3-319-69299-9_CoverFigure.jpg'
      },
      {
        category: 3,
        num: 32,
        img1: constant.resUrl + '/cover/eco/A978-3-319-69772-7_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/eco/A978-3-319-76222-7_CoverFigure.jpg'
      },
      {
        category: 4,
        num: 60,
        img1: constant.resUrl + '/cover/edu/A978-981-13-0194-0_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/edu/978-3-319-72170-5_CoverFigure.jpg'
      },
      {
        category: 5,
        num: 23,
        img1: constant.resUrl + '/cover/eng/A978-3-319-39889-1_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/eng/A978-3-319-00026-8_CoverFigure.jpg'
      },
      {
        category: 6,
        num: 42,
        img1: constant.resUrl + '/cover/env/A978-3-319-12039-3_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/env/A978-4-431-54340-4_CoverFigure.jpg'
      },
      {
        category: 7,
        num: 7,
        img1: constant.resUrl + '/cover/geo/A978-3-319-56091-5_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/geo/978-3-319-75593-9_CoverFigure.jpg'
      },
      {
        category: 8,
        num: 18,
        img1: constant.resUrl + '/cover/his/978-3-319-65244-3_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/his/978-3-319-92964-4_CoverFigure.jpg'
      },
      {
        category: 9,
        num: 13,
        img1: constant.resUrl + '/cover/law/2015_Book_ProtectingTheRightsOfPeopleWit.jpeg',
        img2: constant.resUrl + '/cover/law/2016_Book_ReconsideringConstitutionalFor.jpeg'
      },
      {
        category: 10,
        num: 24,
        img1: constant.resUrl + '/cover/ls/A978-3-319-27288-7_CoverFigure.jpg',
        img2: constant.resUrl + '/cover/ls/A978-1-4939-3743-1_CoverFigure.jpg'
      },
      {
        category: 11,
        num: 6,
        img1: constant.resUrl + '/cover/lit/2015_humanities.jpg',
        img2: constant.resUrl + '/cover/lit/A978-3-319-44388-1_CoverFigure_HTML.jpg'
      },
      {
        category: 12,
        num: 14,
        img1: constant.resUrl + '/cover/bio/2016_Book_ATimeForMetabolismAndHormones.jpeg',
        img2: constant.resUrl + '/cover/bio/2017_Book_SnowSportsTraumaAndSafety.jpeg'
      },
      {
        category: 13,
        num: 16,
        img1: constant.resUrl + '/cover/bm/2017_Book_FashionFigures.jpeg',
        img2: constant.resUrl + '/cover/bm/2018_Book_HeterogeneityHighPerformanceCo.jpeg'
      },
      {
        category: 14,
        num: 16,
        img1: constant.resUrl + '/cover/es/2017_Book_AdvancingCultureOfLivingWithLa.jpeg',
        img2: constant.resUrl + '/cover/es/2017_Book_ChinaSGasDevelopmentStrategies.jpeg'
      },
      {
        category: 15,
        num: 2,
        img1: constant.resUrl + '/cover/ms/2018_Book_ProceedingsOfTheScientific-Pra.jpeg',
        img2: constant.resUrl + '/cover/ms/2018_Book_ProceedingsOfTheScientific-Pra.jpeg'
      },
      {
        category: 16,
        num: 9,
        img1: constant.resUrl + '/cover/mat/2016_Book_AdvancesInDiscreteDifferential.jpeg',
        img2: constant.resUrl + '/cover/mat/2016_Book_ComputingCharacterizationsOfDr.jpeg'
      },
      {
        category: 17,
        num: 20,
        img1: constant.resUrl + '/cover/map/2013_Book_TheSouthTexasHealthStatusRevie.jpeg',
        img2: constant.resUrl + '/cover/map/2016_Book_SecondaryAnalysisOfElectronicH.jpeg'
      },
      {
        category: 18,
        num: 16,
        img1: constant.resUrl + '/cover/phi/2015_Book_TheOnlifeManifesto.jpeg',
        img2: constant.resUrl + '/cover/phi/2017_Book_Anti-VivisectionAndTheProfessi.jpeg'
      },
      {
        category: 19,
        num: 10,
        img1: constant.resUrl + '/cover/phy/2016_Book_OpticsInOurTime.jpeg',
        img2: constant.resUrl + '/cover/phy/2017_Book_InterferometryAndSynthesisInRa.jpeg'
      },
      {
        category: 20,
        num: 26,
        img1: constant.resUrl + '/cover/psa/2016_Book_EnvironmentalGovernanceInLatin.jpeg',
        img2: constant.resUrl + '/cover/psa/2017_Book_RisingPowersAndPeacebuilding.jpeg'
      },
      {
        category: 21,
        num: 3,
        img1: constant.resUrl + '/cover/psy/2015_Book_PromotingSocialDialogueInEurop.jpeg',
        img2: constant.resUrl + '/cover/psy/2015_Book_RethinkingInterdisciplinarityA.jpeg'
      },
      {
        category: 22,
        num: 1,
        img1: constant.resUrl + '/cover/sta/2013_Book_ShipAndOffshoreStructureDesign.jpeg',
        img2: constant.resUrl + '/cover/sta/2013_Book_ShipAndOffshoreStructureDesign.jpeg'
      }
    ]
    // 猜你喜欢数据更新
    // 取到随机的书位置,并进行遍历
    randomArray(9, length).forEach(key => {
      // 调用createData方法就可以得到简单处理的随机书对象,之后将其传入
      // createGuessYouLike方法细致处理后，push进猜你喜欢数组即可
      guessYouLike.push(createGuessYouLike(createData(results, key)))
    })
    // 推荐图书数据更新
    randomArray(3, length).forEach(key => {
      recommend.push(createRecommendData(createData(results, key)))
    })
    // 精选数据更新
    randomArray(6, length).forEach(key => {
      featured.push(createData(results, key))
    })
    // 随机图书数据更新
    randomArray(1, length).forEach(key => {
      random.push(createData(results, key))
    })
    res.json({
      guessYouLike,
      banner,
      recommend,
      featured,
      categoryList,
      categories,
      random
    })
    conn.end()
  })
})
// 详情页数据接口
app.get('/book/detail', (req, res) => {
  const conn = connect()
  // 获取前台传递的fileName参数
  const fileName = req.query.fileName
  // 该语句可以查询通过对比书名，查询指定图书
  const sql = `select * from book where fileName='${fileName}'`
  conn.query(sql, (err, results) => {
    // 查询失败
    if (err) {
      res.json({
        error_code: 1,
        msg: '电子书详情获取失败'
      })
    } else {
      //查询成功，但没有结果
      if (results && results.length === 0) {
        res.json({
          error_code: 1,
          msg: '电子书详情获取失败'
        })
      } else {
        // 成功
        // 保存获取电子书数据对象
        const book = handleData(results[0])
        // 返回数据
        res.json({
          error_code: 0,
          msg: '获取成功',
          data: book
        })
      }
    }
    // 关闭链接
    conn.end()
  })
})
// 列表页数据接口（该接口在点击首页最下方的详细分类列表时调用）
app.get('/book/list', (req, res) => {
  const conn = connect()
  conn.query('select * from book where cover!=\'\'',
      (err, results) => {
        if (err) {
          res.json({
            error_code: 1,
            msg: '获取失败'
          })
        } else {
          // 为所有数据，更新添加属性
          results.map(item => handleData(item))
          // 创建data
          const data = {}
          // 遍历常量中所有的电子书分类
          constant.category.forEach(categoryText => {
            // 通过过滤将所有一类的图书，放到一个数组里，并将这个数组赋值到 data对象的同分类名属性上
            data[categoryText] = results.filter(item => item.categoryText === categoryText)
          })
          // 返回data数据以及图书总数量
          res.json({
            error_code: 0,
            msg: '获取成功',
            data: data,
            total: results.length
          })
        }
        conn.end()
      })
})
// 该接口直接返回所有的图书数据（在首页搜索，查看全部，以及听书部分均有使用）
app.get('/book/flat-list', (req, res) => {
  const conn = connect()
  conn.query('select * from book where cover!=\'\'',
      (err, results) => {
        if (err) {
          res.json({
            error_code: 1,
            msg: '获取失败'
          })
        } else {
          // 为所有数据，更新添加属性
          results.map(item => handleData(item))
          // 返回
          res.json({
            error_code: 0,
            msg: '获取成功',
            data: results,
            total: results.length
          })
        }
        conn.end()
      })
})
// 书架默认图书数据接口
app.get('/book/shelf', (req, res) => {
  // 这里直接设置了默认为空没有添加图书
  res.json({
    bookList: []
  })
})
// 听书数据接口
app.get('/voice', (req, res) => {
  // 传入请求响应，即可得到结果
  voice(req, res)
})

const server = app.listen(3000, () => {
  const host = server.address().address
  const port = server.address().port
  console.log('server is listening at http://%s:%s', host, port)
})
