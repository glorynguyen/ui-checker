import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/',
    component: ComponentCreator('/', '7b5'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', '553'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', '452'),
            routes: [
              {
                path: '/architecture',
                component: ComponentCreator('/architecture', '67c'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/ci',
                component: ComponentCreator('/ci', '568'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/design-tokens',
                component: ComponentCreator('/design-tokens', '832'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/figma-integration',
                component: ComponentCreator('/figma-integration', '146'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/installation',
                component: ComponentCreator('/installation', 'bea'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/tailwind',
                component: ComponentCreator('/tailwind', '986'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/troubleshooting',
                component: ComponentCreator('/troubleshooting', '391'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/vscode-bridge',
                component: ComponentCreator('/vscode-bridge', '6b1'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/workflows/compare-elements',
                component: ComponentCreator('/workflows/compare-elements', 'fa6'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/workflows/visual-overlay',
                component: ComponentCreator('/workflows/visual-overlay', '718'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/',
                component: ComponentCreator('/', 'e98'),
                exact: true,
                sidebar: "mainSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
