const env = require('./env')

// ip地址
let resUrl
// 音频路径
let mp3FilePath
// 数据库地址
let dbHost
// 数据库用户
let dbUser
// 数据库密码
let dbPwd
// 开发环境
if (env === 'dev') {
  resUrl = 'http://192.168.1.7:81'
  mp3FilePath = 'G:/Nginx/nginx-1.16.1/resource/mp3'
  dbHost = 'localhost'
  dbUser = 'root'
  dbPwd = '159357'
} else if (env === 'prod'){
  // 生产环境
  // 线上服务器ip地址 使用的默认80端口
  resUrl = 'http://123.57.33.170'
  // 线上服务器mp3目录
  mp3FilePath = '/root/nginx/upload/mp3'
  // 不需要加协议名
  dbHost = '123.57.33.170/'
  dbUser = 'root'
  dbPwd = 'Qsc56789!'
}


const category = [
  'Biomedicine',
  'BusinessandManagement',
  'ComputerScience',
  'EarthSciences',
  'Economics',
  'Engineering',
  'Education',
  'Environment',
  'Geography',
  'History',
  'Laws',
  'LifeSciences',
  'Literature',
  'SocialSciences',
  'MaterialsScience',
  'Mathematics',
  'MedicineAndPublicHealth',
  'Philosophy',
  'Physics',
  'PoliticalScienceAndInternationalRelations',
  'Psychology',
  'Statistics'
]

module.exports = {
  resUrl,
  category,
  mp3FilePath,
  dbHost,
  dbUser,
  dbPwd
}
