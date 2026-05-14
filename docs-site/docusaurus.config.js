// @ts-check

const config = {
  title: 'UI Checker',
  tagline: 'Figma fidelity checks inside Chrome DevTools and CI',
  favicon: 'img/logo.svg',
  url: 'https://example.com',
  baseUrl: '/',
  organizationName: 'ui-checker',
  projectName: 'ui-checker',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: undefined
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css')
        }
      }
    ]
  ],

  themeConfig: {
    image: 'img/logo.svg',
    navbar: {
      title: 'UI Checker',
      logo: {
        alt: 'UI Checker logo',
        src: 'img/logo.svg'
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'mainSidebar',
          position: 'left',
          label: 'Docs'
        },
        {
          href: 'https://github.com/',
          label: 'GitHub',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Use',
          items: [
            { label: 'Install', to: '/installation' },
            { label: 'Compare Elements', to: '/workflows/compare-elements' },
            { label: 'Troubleshooting', to: '/troubleshooting' }
          ]
        },
        {
          title: 'Integrate',
          items: [
            { label: 'Figma', to: '/figma-integration' },
            { label: 'VS Code Bridge', to: '/vscode-bridge' },
            { label: 'CI Runner', to: '/ci' }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} UI Checker.`
    },
    prism: {
      additionalLanguages: ['bash', 'json', 'css']
    }
  }
};

module.exports = config;
