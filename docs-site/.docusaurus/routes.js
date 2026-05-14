import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', 'e1f'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', '302'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', '4a9'),
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
