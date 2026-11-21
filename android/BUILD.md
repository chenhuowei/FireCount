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

产物：仓库根目录 `小伙记账-<版本>.apk`（versionCode/versionName 可用环境变量覆盖，脚本默认 `VC=11 VN=1.1.1`）。

## 签名密钥库（重要）

- 项目内备份：`android/kdjz.keystore`，别名 `kdjz`（与 1.0.9 及之前版本同一签名，可覆盖升级）。
- **该 keystore 含签名私钥，已被 .gitignore 排除，不会进入版本库**。请务必单独备份此文件；
  丢失后无法用同一签名升级，只能让用户卸载后重装。
- 构建时把 `KS_PASS` 设为该密钥库密码即可；`build.sh` 默认使用 `android/kdjz.keystore`（可用 `KS=路径` 覆盖）。
- 历史证书指纹：SHA-256 `F8:CD:7E:EC:6F:6E:C0:56:73:B5:AB:4A:67:23:36:47:03:9D:A7:C5:19:26:DE:F2:F2:9D:1F:0E:56:18:A1:00`。
  重新构建后可用 `apksigner verify --print-certs <apk>` 核对，确保与历史版本一致。

## 工程结构

```
android/
├── app/
│   ├── AndroidManifest.xml       # 包名 com.firecount · 小伙记账 · 预测性返回
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
