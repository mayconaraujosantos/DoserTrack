#!/usr/bin/env nu
# setup-avd.nu — Instala Android cmdline-tools e cria AVD para o projeto doser.
# Para URL atualizada: https://developer.android.com/studio#command-tools
#
# Uso: nu setup-avd.nu

let SDK_PATH   = ($env.LOCALAPPDATA | path join "Android" "Sdk")
let AVD_NAME   = "doser_dev"
let API_LEVEL  = "35"
let SYSTEM_IMG = $"system-images;android-($API_LEVEL);google_apis;x86_64"
let TOOLS_URL  = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
let TEMP_DIR   = ($env.TEMP | path join "avd-setup")
let SDKMANAGER = ($SDK_PATH | path join "cmdline-tools" "latest" "bin" "sdkmanager.bat")
let AVDMANAGER = ($SDK_PATH | path join "cmdline-tools" "latest" "bin" "avdmanager.bat")
let EMULATOR   = ($SDK_PATH | path join "emulator" "emulator.exe")

print "╔══════════════════════════════════════╗"
print "║   Setup AVD Android — doser          ║"
print "╚══════════════════════════════════════╝\n"

# ── 1. cmdline-tools ─────────────────────────────────────────────────────────
if not ($SDKMANAGER | path exists) {
    print "[1/3] Baixando Android cmdline-tools..."
    print $"      URL: ($TOOLS_URL)\n"

    mkdir $TEMP_DIR

    let zip = ($TEMP_DIR | path join "cmdtools.zip")
    ^curl -L --progress-bar -o $zip $TOOLS_URL

    if not ($zip | path exists) {
        print "ERRO: Download falhou. Verifique a URL em https://developer.android.com/studio#command-tools"
        exit 1
    }

    print "\n      Extraindo..."
    ^powershell -Command $"Expand-Archive -Path '($zip)' -DestinationPath '($TEMP_DIR)' -Force"

    let dest = ($SDK_PATH | path join "cmdline-tools")
    if not ($dest | path exists) { mkdir $dest }

    let extracted = ($TEMP_DIR | path join "cmdline-tools")
    let latest = ($dest | path join "latest")
    if ($latest | path exists) { rm -r -f $latest }
    mv $extracted $latest

    print "      [OK] cmdline-tools instalado.\n"
} else {
    print "[1/3] cmdline-tools já instalado. Pulando.\n"
}

# ── 2. Licenças + system image ───────────────────────────────────────────────
print $"[2/3] Aceitando licenças e instalando android-($API_LEVEL) system image..."

let sdk_flag = $"--sdk_root=($SDK_PATH)"

(1..25 | each {|_| "y"} | str join (char newline)) | ^$SDKMANAGER $sdk_flag --licenses

^$SDKMANAGER $sdk_flag $"platforms;android-($API_LEVEL)" $SYSTEM_IMG

print "      [OK] System image instalada.\n"

# ── 3. Criar AVD ─────────────────────────────────────────────────────────────
print $"[3/3] Criando AVD '($AVD_NAME)'..."

let avd_exists = (^$EMULATOR -list-avds | lines | any {|l| $l == $AVD_NAME})
if $avd_exists {
    print $"      AVD '($AVD_NAME)' já existe. Recriando com --force..."
}

with-env { ANDROID_SDK_ROOT: $SDK_PATH } {
    "no" | ^$AVDMANAGER create avd --name $AVD_NAME --package $SYSTEM_IMG --device "pixel_6" --force
}

print "      [OK] AVD criado.\n"

# ── Resumo ───────────────────────────────────────────────────────────────────
print "╔══════════════════════════════════════╗"
print "║   Pronto!                            ║"
print "╚══════════════════════════════════════╝"
print ""
print "Iniciar emulador:"
print $"  ^'($EMULATOR)' -avd ($AVD_NAME)"
print ""
print "Rodar o app (development build — primeira vez compila e instala no dispositivo):"
print "  cd d:\\projetos\\doser"
print "  bun run android"
print ""
print "Depois de instalado, iniciar o Metro em modo dev-client:"
print "  bun run start"
