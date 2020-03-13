// 这里向外暴露一个env变量，
// 当开发环境时，env 设为 'dev'
// 生产环境时，将其改为 'prod'
// 在const.js 中通过判断env的值，从而区分不同模式下的网络地址
const env = 'prod'

module.exports = env
