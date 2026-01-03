module.exports = {
    appId: 'com.saveapp.app',
    productName: 'SaveApp',
    directories: {
        output: 'release/${version}',
        buildResources: 'resources',
    },
    files: [
        'dist/**/*',
        'electron/**/*',
        '!**/*.ts',
        '!**/*.map',
        'package.json',
    ],
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
