module.exports = {
    appId: 'com.saveapp.app',
    productName: 'SaveApp',
    directories: {
        output: 'release/${version}',
        buildResources: 'resources',
    },
    extraResources: [
        {
            from: 'google-credentials.json',
            to: 'google-credentials.json',
        },
    ],
    files: [
        'dist/**/*',
        'electron/**/*',
        '!**/*.ts',
        '!**/*.map',
        'package.json',
    ],
    publish: {
        provider: 'github',
        releaseType: 'release',
    },
    win: {
        target: 'nsis',
        icon: 'resources/icon.png',
    },
    nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        shortcutName: 'SaveApp',
    },
}
