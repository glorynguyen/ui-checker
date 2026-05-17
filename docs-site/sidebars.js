// @ts-check

const sidebars = {
  mainSidebar: [
    'intro',
    'installation',
    {
      type: 'category',
      label: 'Extension Workflows',
      items: [
        'figma-integration',
        'workflows/compare-elements',
        'workflows/visual-overlay',
        'design-tokens',
        'tailwind',
        'vscode-bridge'
      ]
    },
    {
      type: 'category',
      label: 'Automation',
      items: ['ci']
    },
    {
      type: 'category',
      label: 'Reference',
      items: ['architecture', 'troubleshooting']
    }
  ]
};

module.exports = sidebars;
