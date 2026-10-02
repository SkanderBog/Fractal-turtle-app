# 海龟实验室：测试版启动说明

先完整解压，保持所有文件在一起。

- Windows x64：双击 `TurtleLab.exe`。
- macOS：双击 `Start Turtle Lab.command`，或在终端运行 `./TurtleLab`。Apple Silicon 选 arm64，Intel 选 x64。
- Linux x64：在解压目录的终端执行 `./TurtleLab`。需要 glibc 2.35+（Ubuntu 22.04 或更新版本，或兼容发行版）。

启动器会打开默认浏览器。保留终端窗口，按 Ctrl+C 停止本机服务器。若浏览器没有打开，复制终端打印的本机地址。无需另外安装 Python，也无需联网；浏览器须支持 Canvas 和模块 worker。

这些包未签名，macOS 包未公证，Windows 或 macOS 可能阻止运行。请遵循所在组织的软件规定，也可按源码说明运行。它们是早期测试包，不是正式安装程序；尚未认证所有实体设备上的图形界面启动行为。

启动器优先使用 4173 端口，占用时选择空闲端口。配置属于特定浏览器和端口，请用 JSON 备份或迁移。`./TurtleLab --port 4174` 指定稳定的备用端口，`--no-browser` 禁止自动打开浏览器。关闭标签页不会停止服务器。

可尝试“规则 → 各位数字的权重之和”，给每个数字设置整数权重。允许负数，结果映射为 0 至除数减 1 的余数。例如，二进制权重 [−2, 1] 使 101₂ 的结果为 `1 − 2 + 1 = 0`。数值零只贡献一次数字 0 的权重，不补前导零。

`BUILD-INFO.json` 记录源码提交和构建工具；`MANIFEST.json` 记录包内文件的 SHA-256；发行版的 `SHA256SUMS` 用于校验完整压缩包。`THIRD_PARTY` 保存运行时、构建工具和组件声明。

源码、说明和问题反馈：[GitHub 仓库](https://github.com/SkanderBog/Fractal-turtle-app)。报告问题时不要包含私人配置、凭据或个人路径。仓库中另保留英文原稿 `packaging/START_HERE.en.md`。
