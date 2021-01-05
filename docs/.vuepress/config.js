const fs = require('fs');
const footnote = require('markdown-it-footnote');

module.exports = {
    dest: './dist',
    head: [
        ['link', { rel: 'icon', href: '/favicon.svg' }],
        ['link', { rel: 'manifest', href: '/manifest.json' }],
        ['meta', { name: 'theme-color', content: '#3eaf7c' }],
        ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
        ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
        ['link', { rel: 'apple-touch-icon', href: '/favicon.svg' }],
        ['link', { rel: 'mask-icon', href: '/favicon.svg', color: '#3eaf7c' }],
        ['meta', { name: 'msapplication-TileImage', content: '/favicon.svg' }],
        ['meta', { name: 'msapplication-TileColor', content: '#000000' }],
    ],
    title: `Code Notes`,
    permalink: "/:year/:month/:day/:slug",
    description: ' ',
    plugins: {
        '@vuepress/pwa': {
            serviceWorker: true,
            updatePopup: {
                message: "New content is available.",
                buttonText: "Refresh"
            },
        }
    },
    theme: 'reco',
    themeConfig: {
        // reco
        authorAvatar: '/avatar.svg',
        author: 'Urie',
        blogConfig: getRecoBlogConfig(),
        valineConfig: getValineConfig(),
        type: 'blog',
        noFoundPageByTencent: false,
        subSidebar: 'auto',
        mode: 'light', // 默认 auto，auto 跟随系统，dark 暗色模式，light 亮色模式
        modePicker: true, // 默认 true，false 不显示模式调节按钮，true 则显示
        // default
        nav: [
            { text: 'Home', link: '/', icon: 'reco-home' },
            { text: 'TimeLine', link: '/timeline/', icon: 'reco-date' }, // reco
            { text: 'Github', link: 'https://github.com/Urie96', icon: 'reco-github' },
        ],
        smoothScroll: true,
        docsRepo: 'Urie96/code-notes',
        // 假如文档不是放在仓库的根目录下：
        docsDir: 'docs',
        // 假如文档放在一个特定的分支下：
        docsBranch: 'main',
        editLinks: true,
        // editLinkText: '在 GitHub 上编辑此页',
        logo: '/favicon.svg',
        sidebar: getSideBar(),
        sidebarDepth: 1,
        displayAllHeaders: false,
        activeHeaderLinks: true,
        search: true,
        searchMaxSuggestions: 10,
        lastUpdated: 'Last Updated',
        codeTheme: 'tomorrow',
    },
    markdown: {
        // markdown-it-anchor 的选项
        anchor: { permalink: false },
        // markdown-it-toc 的选项
        // toc: { includeLevel: [1, 2, 3, 4, 5] },
        extendMarkdown: md => {
            md.use(footnote)
            // 使用更多的 markdown-it 插件!
            //   md.use(require('markdown-it-xxx'))
        }
    },
    configureWebpack: (config, isServer) => {
        /** @type {import('webpack').Configuration} */
        const cfg = {}
        return cfg
    },
}


function getSideBar() {
    return [
        // {
        //     title: '笔记',
        //     collapsable: true,
        //     sidebarDepth: 1,
        //     children: getFileNamesInFolder('docs/Dev-Ops'),
        // },
        // {
        //     title: '项目',
        //     children: getFileNamesInFolder('docs/projects'),
        // }
    ]
}

function getFileNamesInFolder(folderPath) {
    const prefix = folderPath.match(/[^/]+$/)[0] + '/'
    const fileNames = fs.readdirSync(folderPath).filter(v => v.endsWith('.md')).map(v => prefix + v.replace(/\.md$/, ''))
    return fileNames
}

function getRecoBlogConfig() {
    return {
        category: {
            location: 2,     // 在导航栏菜单中所占的位置，默认2
            text: 'Category'
        },
        tag: {
            location: 3,     // 在导航栏菜单中所占的位置，默认3
            text: 'Tag'
        },
        socialLinks: [
            { icon: 'reco-github', link: 'https://github.com/Urie96' },
            { icon: 'reco-mail', link: 'mailto:urie@mail.ustc.edu.cn' },
        ],
    }
}

function getValineConfig() {
    return {
        appId: 'fSNwRSMOQpKoQRjh445uVuRd-gzGzoHsz',
        appKey: '3JI5UOTHspBwX1DC91nx6rbW',
        placeholder: '这里可以直接发评论哦～',
        lang: 'en',
    }
}