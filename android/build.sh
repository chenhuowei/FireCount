#!/bin/bash
# 小伙记账 · Android APK 一键构建脚本（Git Bash / Linux 通用思路，Windows 下用 Git Bash 运行）
#
# 依赖（详见 BUILD.md）：
#   ANDROID_BT   = Android build-tools 34 目录（含 aapt2 / d8 / zipalign / apksigner）
#   ANDROID_JAR  = platform-34 的 android.jar 路径
#   KS_PASS      = 签名密钥库密码（密钥库不存在时会自动生成 kdj.keystore）
# 环境变量示例：
#   ANDROID_BT=/d/tools/android-14 ANDROID_JAR=/d/tools/android-34/android.jar KS_PASS=xxxx ./build.sh
set -e
cd "$(dirname "$0")"

BT="${ANDROID_BT:?请先设置 ANDROID_BT=build-tools 目录}"
AJAR="${ANDROID_JAR:?请先设置 ANDROID_JAR=android.jar 路径}"
KSPASS="${KS_PASS:?请先设置 KS_PASS=签名密码}"
KS="${KS:-kdj.keystore}"
VC="${VC:-7}"     # versionCode
VN="${VN:-1.0.7}"   # versionName
BTW=$(cygpath -w "$BT"); ROOTW=$(cygpath -w "$PWD")

rm -rf build && mkdir -p build/classes build/dexout app/assets/www

echo "[1/7] 同步 Web 资产"
cp -r ../index.html ../css ../js app/assets/www/

echo "[2/7] 生成图标（如无 res 可先生成）"
[ -d app/res ] || { node genicon.js app/res; }

echo "[3/7] 编译资源与清单"
"$BT/aapt2" compile --dir app/res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$AJAR" --manifest app/AndroidManifest.xml \
  --min-sdk-version 24 --target-sdk-version 34 --version-code "$VC" --version-name "$VN" build/res.zip

echo "[4/7] 编译 Java → dex"
javac -source 8 -target 8 -encoding UTF-8 -classpath "$AJAR" -d build/classes \
  app/java/com/firecount/MainActivity.java
jar cf build/classes-bundle.jar -C build/classes .
printf '@echo off\r\ncall "%s\\d8.bat" --release --lib "%s" --output "%s\\build\\dexout" "%s\\build\\classes-bundle.jar"\r\nif errorlevel 1 exit /b 1\r\n' \
  "$BTW" "$(cygpath -w "$AJAR")" "$ROOTW" "$ROOTW" > build/_d8.bat
cmd //c "$(cygpath -w "$PWD")\\build\\_d8.bat"

echo "[5/7] 打包（assets/dex 用 jar 保持正斜杠路径，规避 aapt2 -A 的反斜杠问题）"
jar uf build/base.apk -C app assets
jar uf build/base.apk -C build/dexout classes.dex

echo "[6/7] 对齐"
"$BT/zipalign" -f 4 build/base.apk build/aligned.apk

echo "[7/7] 签名"
[ -f "$KS" ] || keytool -genkeypair -v -keystore "$KS" -alias firecount -keyalg RSA -keysize 2048 \
  -validity 10950 -storepass "$KSPASS" -keypass "$KSPASS" \
  -dname "CN=XiaoHu, OU=Dev, O=Personal, L=Beijing, C=CN"
printf '@echo off\r\ncall "%s\\apksigner.bat" sign --ks "%s" --ks-pass pass:%s --key-pass pass:%s --ks-key-alias firecount --out "%s\\build\\firecount-signed.apk" "%s\\build\\aligned.apk"\r\nif errorlevel 1 exit /b 1\r\ncall "%s\\apksigner.bat" verify "%s\\build\\firecount-signed.apk"\r\n' \
  "$BTW" "$ROOTW\\$KS" "$KSPASS" "$KSPASS" "$ROOTW" "$ROOTW" "$BTW" "$ROOTW" > build/_sign.bat
cmd //c "$(cygpath -w "$PWD")\\build\\_sign.bat"

cp build/firecount-signed.apk "../小伙记账-v$VN.apk"
echo "完成: $(dirname "$PWD")/小伙记账-v$VN.apk"
