# 仓库阅读与维护地图

使用者从[首页](../README.md)进入[使用说明](../turtle-lab/README.md)；下载包用户先读[启动说明](../packaging/START_HERE.md)。开发者依次读[验证记录](../turtle-lab/VERIFICATION.md)、[安全说明](../SECURITY.md)和[打包说明](../packaging/README.md)。英文原稿与中文文档相邻，以 `.en.md` 命名。

`dist/` 在本项目中是手工维护的浏览器源代码目录，不是可删除的构建缓存。模型运算放在 `core.mjs` 和 `edge.mjs`，界面和中文提示放在 `app.mjs` 与 `zh-CN.mjs`，输入验证放在 `setup.mjs`。修改服务资源时同步检查 `serve.py` 的允许列表及打包冒烟测试。

研究仓库与应用独立：应用不携带大型轨迹、未完成证明或研究 PDF。原始许可证和第三方声明保持原文；中文说明不授予整个项目新的许可证。
