# SocAdmin

Firefox extension for VK community administration.

SocAdmin is a browser toolbar embedded directly into VK pages. It works with the authenticated VK web interface and does not use the VK API.

## Current version

**1.0.0** — first stable browser-extension release.

The current release provides:

- local management of source and home communities;
- collection of recent posts from selected VK communities with a strict configured limit;
- moderation and editing of collected posts;
- hashtags, emoji and templates in the editor;
- local publication queue;
- manual VK publication workflow with the **Авто** button that fills the VK post form with text and image and then stops for user confirmation/publication;
- local community-avatar caching;
- import/export of configuration;
- operation only on `vk.ru` and `vk.com`.

## Installation for development

1. Open Firefox → `about:debugging`.
2. Select **This Firefox**.
3. Choose **Load Temporary Add-on**.
4. Select `manifest.json` from the repository.

Temporary installation is intended for development. A signed self-distributed build will be used for permanent installation and automatic updates.

## Project structure

```text
SocAdmin/
├── content/
│   └── vk.js
├── background.js
├── manifest.json
└── README.md
```

## Development

The extension is intentionally implemented against stable DOM semantics exposed by VK where possible. Dynamic VK CSS class names should not be used as selectors when a semantic attribute, text, role or `data-testid` is available.

Future improvements and discovered defects are tracked through GitHub Issues.
