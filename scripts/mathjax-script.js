window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      packages: {'[+]': ['ams']},
      // Enable automatic line breaking
      maxBuffer: 10240,
      tags: 'ams',
    },
    options: {
      renderActions: {
        addMenu: [0, '', ''], // Disable MathJax menu on equations
      },
    },
    chtml: {
      linebreaks: { automatic: true },
      displayAlign: 'center',
      displayIndent: '0',
      scale: 1,
      minScale: 0.5,
      adaptiveCSS: true,
    },
  };
  