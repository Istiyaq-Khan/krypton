tailwind.config.js
```
colors: {
 'text': 'var(--text)',
 'background': 'var(--background)',
 'primary': 'var(--primary)',
 'secondary': 'var(--secondary)',
 'accent': 'var(--accent)',
},

```
[cssfile].css
```
@layer base {
  :root {
    --text: #e1e7ef;
    --background: #0a0b10;
    --primary: #00eeff;
    --secondary: #121521;
    --accent: #3abff8;
  }
  .Phosphor.Emerald {
    --text: #F1F5F2;
    --background: #0A0D0B;
    --primary: #10B981;
    --secondary: #141A16;
    --accent: #A7F3D0;
  }
  .Obsidian {
    --text: #F5F5F4;
    --background: #0C0A09;
    --primary: #F59E0B;
    --secondary: #1C1917;
    --accent: #FDE68A;
  }
  .Monochrome {
    --text: #EDEDED;
    --background: #000000;
    --primary: #FF2A55;
    --secondary: #161616;
    --accent: #FFFFFF;
  }
}
```