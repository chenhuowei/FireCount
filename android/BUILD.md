# Android APK 构建指南

将本仓库的 Web 应用打包为原生 APK（WebView 壳，零权限、离线运行、SQLite 持久化）。

## 一次性准备（约 120MB，下载两份官方工具）

1. **build-tools 34**（提供 aapt2 / d8 / zipalign / apksigner）：
   https://dl.google.com/android/repository/build-tools_r34-windows.zip → 解压到任意目录，如 `D:\tools\android-14`
2. **platform-34**（提供编译用 android.jar）：
   https://dl.google.com/android/repository/platform-34-ext7_r03.zip → 解压，取出 `android-34/android.jar`，如 `D:\tools\android.jar`
3. **JDK 8+**（javac / jar / keytool，需在 PATH 中）
4. Windows 下用 **Git Bash** 运行构建脚本

## 构建

```bash
cd android
ANDROID_BT=/d/tools/android-14 \
ANDROID_JAR=/d/tools/android.jar \
KS_PASS=你的签名密码 \
./build.sh
```

产物：仓库根目录 `小伙记账-v<版本>.apk`（versionCode/versionName 可用 `VC=4 VN=1.3` 环境变量覆盖）。

首次构建会自动生成签名密钥库 `android/kdjz.keystore`（**已被 .gitignore 排除，请自行备份**；
丢失后将无法覆盖升级安装，只能卸载重装）。升级安装需使用同一密钥库签名。

## 工程结构

```
android/
├── app/
│   ├── AndroidManifest.xml       # 包名 com.kdjz.clone · 小伙记账 · 预测性返回
│   ├── java/.../MainActivity.java # WebView 壳：SQLite 桥 / 返回桥 / 文件选择器 / 导出桥
│   └── res/mipmap-*/             # 各密度启动图标
├── genicon.js                    # 图标生成器（记账本+¥，纯 Node 无依赖）
└── build.sh                      # 一键构建（资源→dex→打包→对齐→签名）
```

## 技术要点

- assets 打包用 `jar uf` 而非 aapt2 的 `-A`（规避 Windows 下反斜杠路径导致 Android 端加载不到资产）
- 数据持久化：`AndroidBridge.dbSave/dbLoad` → 原生 SQLite（异步单线程写队列，不阻塞 UI）
- 返回：Android 13+ 走 `OnBackInvokedCallback`（预测性返回），旧版本走 `onBackPressed`，均转发网页 `nativeBack()` 逐级返回
- 调试：已开启 `setWebContentsDebuggingEnabled`，手机连 USB 后可在电脑 Chrome `chrome://inspect` 检查页面
