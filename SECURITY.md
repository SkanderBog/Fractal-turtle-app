# 安全说明

[English](SECURITY.en.md) · [项目首页](README.md)

海龟实验室是本机静态应用，没有账户系统、云数据库、遥测、外部字体或运行时软件包依赖。GitHub 仓库用于分发源码，不发布托管应用。

## 边界

- `serve.py` 只监听 `127.0.0.1`，只接受准确的 localhost／127.0.0.1 主机及端口，拒绝意外或重复的 Host 头。
- 服务器只提供固定允许列表中的公共应用文件，不列出目录、不跟随符号链接、不暴露仓库元数据，也不实现写入方法。
- HTTP 头将脚本、样式与 worker 限制在本机资源，禁止外连、页面嵌入、对象嵌入和表单提交，关闭 MIME 猜测，并禁止发送 referrer。静态页也有匹配的 CSP meta；禁止框架嵌入仍需 HTTP 头。
- 用户可控字符串按文本显示，不使用 HTML 注入、表达式求值或动态远程代码。界面文字和错误提示在本地翻译，不联网翻译用户配置。
- JSON 导入限制 64 KB，检查版本、允许字段、数值范围和颜色字面量，拒绝未知及原型相关字段。验证完成后才更新界面。
- 最多接受 1,000,000 项、8 种余数；拒绝整数溢出。新 worker 会终止旧的未完成计算。
- 权重必须是覆盖当前进制的 2–36 个有界整数，负数和会归一到合法余数。权重是数据，不是代码或表达式。
- 浏览器只存储用户明确保存的配置；本地托管元数据、环境文件、缓存和代理配置不进入 Git。
- CI 使用只读仓库权限，并固定 GitHub Actions 的完整提交哈希。
- 测试包包含 Python 和 PyInstaller 启动程序。构建版本固定，依赖经过检查并记录，解压后测试二进制。压缩包校验和检测下载内容变化，但不是代码签名。包未签名，macOS 包未公证。

## 验证及限制

自动测试覆盖畸形输入、数值边界、类似 HTML 的名称、原型相关字段、HTTP 路径穿越、符号链接逃逸、恶意 Host 头、安全响应头和不支持的写入请求。浏览器检查验证了名称按字面显示，以及无效导入被拒绝后仍保留先前有效实验。

这些检查不是完整安全审计，也不保证不存在所有漏洞。服务器用于本机，不应暴露到公共网络。换用其他静态托管时，需要同等 HTTP 头，尤其是 `frame-ancestors`。浏览器扩展、被攻破的本机账户、以及能访问浏览器配置目录的其他应用不在本应用保护范围内。删除保存配置没有应用内撤销，可用导出的 JSON 备份恢复。

## 参考

- [Python HTTP 服务器安全说明](https://docs.python.org/3/library/http.server.html#security-considerations)：通用服务器的符号链接行为及相关限制。
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)：应用所用资源限制。
- [MDN frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)：防止框架嵌入需要 HTTP 头。

疑似安全问题请私下报告仓库所有者，不要在公开 issue 中发布私人配置或凭据。
