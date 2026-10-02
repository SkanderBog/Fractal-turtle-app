# 测试版分发与构建

[English](README.en.md) · [项目首页](../README.md) · [启动说明](START_HERE.md)

版本 1.3.0-alpha.1 提供便携包：浏览器应用配合内置 Python 启动器，不是 Electron 应用或系统安装器。请完整解压，保持可执行文件与 `_internal` 目录在一起；下载后可离线使用。

| 压缩包目标 | 原生构建及冒烟测试环境 | 目标平台 |
|---|---|---|
| linux-x64 | Ubuntu 22.04 x64 | glibc 2.35+ Linux x64 |
| windows-x64 | Windows Server 2022 x64 | Windows 10/11 x64；桌面 GUI 测试仍待完成 |
| macos-arm64 | macOS 14 Apple Silicon | macOS 14+ Apple Silicon |
| macos-x64 | macOS 15 Intel | macOS 15+ Intel |

每次构建运行全部源码测试，用 pip-audit 检查已安装构建依赖，使用固定版 PyInstaller 打包，将归档解压到含空格的路径，按 `MANIFEST.json` 核对每个文件，启动真实包内程序，再检查全部 **9** 个准确应用资源及安全头、路径穿越、恶意主机头、写入拒绝和 HEAD 响应。新增资源为本地中文提示模块。这些检查验证可执行程序启动和服务，不模拟所有操作系统上的图形浏览器。

包未签名，macOS 包未公证，SmartScreen 或 Gatekeeper 可能阻止启动。实体设备的 GUI 启动、系统提示、浏览器下载和广泛兼容性仍属于测试版验证工作。请遵守当地软件规定，也可使用已安装 Python 运行源码。

启动器监听 `127.0.0.1`，优先选 4173 端口并打开默认浏览器；收到 Ctrl+C 后停止。端口占用时选择空闲端口，不打开占用该端口的现有服务。可用 `--port 4174` 固定备用端口，`--port 0` 请求任意空闲端口，或 `--no-browser` 禁止打开浏览器。浏览器存储依赖准确来源及端口，迁移请导出 JSON。

## 重新构建

在各目标原生系统中使用 Python 3.14.7 和 Node.js 22：

```sh
python -m pip install -r packaging/requirements-build.txt
python packaging/audit.py
python packaging/build.py --target linux-x64
python packaging/smoke.py release-dist/TurtleLab-1.3.0-alpha.1-linux-x64.tar.gz
```

Windows／macOS 请替换目标和压缩包名称。构建拒绝不匹配的操作系统、架构或 Python 版本。PyInstaller 入口及数据目录明确指定，不复制整个仓库。Python、PyInstaller 及依赖均固定版本。

每个归档包含 `START_HERE.md`、记录源码提交及准确 Python／依赖版本的 `BUILD-INFO.json`、`MANIFEST.json` 和第三方声明。记录构建环境并不表示归档可逐字节复现。发布只使用经过测试的源码提交产物，并附 `SHA256SUMS`。

构建工作流只有只读仓库权限，不能自行发布发行版或修改可见性。PR 运行源码检查；主分支 push 和手动触发运行原生打包。源码中文化后，旧发行包不会自动更新；以下载包中的提交号为准。

参考：[PyInstaller 原生构建要求](https://pyinstaller.org/en/latest/usage.html)、[GitHub runner 平台](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)、[Python 3.14.7](https://www.python.org/downloads/release/python-3147/)、[Python 第三方许可](https://docs.python.org/3.14/license.html)。
