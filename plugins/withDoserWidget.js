// @ts-check
const {
  withAndroidManifest,
  withDangerousMod,
  withAppBuildGradle,
} = require('@expo/config-plugins');
const { getMainApplication } = require('@expo/config-plugins/build/android/Manifest');
const fs = require('fs');
const path = require('path');

const APP_GROUP = 'group.com.mayconaraujosantos.doser';
const WIDGET_PROVIDER = 'expo.modules.doserwidget.DoserWidgetProvider';

// ─── Android: adiciona receiver no AndroidManifest ────────────────────────────

function withAndroidWidget(config) {
  return withAndroidManifest(config, async conf => {
    const app = getMainApplication(conf.modResults);
    if (!app) return conf;

    const receivers = app.receiver ?? [];
    const hasReceiver = receivers.some(r => r.$?.['android:name'] === WIDGET_PROVIDER);

    if (!hasReceiver) {
      app.receiver = [
        ...receivers,
        {
          $: {
            'android:name': WIDGET_PROVIDER,
            'android:exported': 'false',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
            },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.appwidget.provider',
                'android:resource': '@xml/doser_widget_info',
              },
            },
          ],
        },
      ];
    }

    return conf;
  });
}

// ─── Android: copia fontes nativas do módulo para o projeto Android ───────────

function withAndroidWidgetSources(config) {
  return withDangerousMod(config, [
    'android',
    async conf => {
      const root = conf.modRequest.platformProjectRoot;
      const src = path.join(__dirname, '..', 'modules', 'doser-widget', 'android', 'src');
      const dest = path.join(root, 'app', 'src');
      copyDirSync(src, dest);
      return conf;
    },
  ]);
}

// ─── iOS: adiciona App Group entitlement ao app principal ─────────────────────

function withIosAppGroup(config) {
  return withDangerousMod(config, [
    'ios',
    async conf => {
      const root = conf.modRequest.platformProjectRoot;
      const appName = conf.modRequest.projectName;
      const entPath = path.join(root, appName, `${appName}.entitlements`);

      let content = fs.existsSync(entPath)
        ? fs.readFileSync(entPath, 'utf8')
        : ENTITLEMENTS_PLIST_EMPTY;

      if (!content.includes(APP_GROUP)) {
        content = content.replace(
          '</dict>\n</plist>',
          `\t<key>com.apple.security.application-groups</key>\n\t<array>\n\t\t<string>${APP_GROUP}</string>\n\t</array>\n</dict>\n</plist>`
        );
        fs.writeFileSync(entPath, content);
      }

      return conf;
    },
  ]);
}

// ─── iOS: copia extensão WidgetKit e cria Info.plist + entitlements ───────────

function withIosWidgetExtension(config) {
  return withDangerousMod(config, [
    'ios',
    async conf => {
      const root = conf.modRequest.platformProjectRoot;
      const extSrc = path.join(
        __dirname,
        '..',
        'modules',
        'doser-widget',
        'ios',
        'DoserWidgetExtension'
      );
      const extDest = path.join(root, 'DoserWidgetExtension');

      copyDirSync(extSrc, extDest);

      const infoPlistPath = path.join(extDest, 'Info.plist');
      if (!fs.existsSync(infoPlistPath)) {
        fs.writeFileSync(infoPlistPath, WIDGET_INFO_PLIST);
      }

      const entPath = path.join(extDest, 'DoserWidgetExtension.entitlements');
      if (!fs.existsSync(entPath)) {
        fs.writeFileSync(entPath, WIDGET_ENTITLEMENTS);
      }

      return conf;
    },
  ]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const ENTITLEMENTS_PLIST_EMPTY = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>`;

const WIDGET_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>DoserWidget</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>`;

const WIDGET_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>`;

// ─── Plugin principal ─────────────────────────────────────────────────────────

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withDoserWidget = config => {
  config = withAndroidWidget(config);
  config = withAndroidWidgetSources(config);
  config = withIosAppGroup(config);
  config = withIosWidgetExtension(config);
  return config;
};

module.exports = withDoserWidget;
