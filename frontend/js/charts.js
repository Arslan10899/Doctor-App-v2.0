/* ==========================================================================
   Doctor Application – lightweight SVG charts (no external library)
   ========================================================================== */

const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function niceMax(value) {
    if (value <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;
    let step;
    if (normalized <= 1) step = 1;
    else if (normalized <= 2) step = 2;
    else if (normalized <= 5) step = 5;
    else step = 10;
    return step * magnitude;
  }

  function tooltipFor(host) {
    let tip = host.querySelector('.chart-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tooltip';
      host.appendChild(tip);
    }
    return tip;
  }

  /* ---------------------------------------------------------------------
   * Area / line chart
   * ------------------------------------------------------------------- */
  function area(host, options) {
    if (!host) return;

    const {
      labels = [],
      series = [],
      formatValue = (v) => Utils.number(v),
      formatLabel = (l) => l,
    } = options;

    const render = () => {
      const width = Math.max(host.clientWidth || 640, 280);
      const height = Math.max(host.clientHeight || 272, 200);
      const pad = { top: 18, right: 14, bottom: 28, left: 42 };

      host.querySelectorAll('svg').forEach((node) => node.remove());
      const tip = tooltipFor(host);

      const svg = el('svg', {
        class: 'chart',
        viewBox: `0 0 ${width} ${height}`,
        width: '100%',
        height: '100%',
        preserveAspectRatio: 'none',
      });

      if (!labels.length || !series.length) {
        host.appendChild(svg);
        return;
      }

      const maxValue = niceMax(
        Math.max(...series.flatMap((s) => s.data.map((v) => Number(v) || 0)), 1)
      );

      const innerW = width - pad.left - pad.right;
      const innerH = height - pad.top - pad.bottom;
      const xStep = labels.length > 1 ? innerW / (labels.length - 1) : innerW;
      const xAt = (i) => pad.left + i * xStep;
      const yAt = (v) => pad.top + innerH - ((Number(v) || 0) / maxValue) * innerH;

      /* --- grid + y axis --- */
      const ticks = 4;
      for (let i = 0; i <= ticks; i += 1) {
        const value = (maxValue / ticks) * i;
        const y = yAt(value);
        svg.appendChild(
          el('line', {
            x1: pad.left,
            x2: width - pad.right,
            y1: y,
            y2: y,
            stroke: 'var(--border)',
            'stroke-width': 1,
            'stroke-dasharray': i === 0 ? '0' : '3 4',
          })
        );
        const label = el('text', {
          x: pad.left - 8,
          y: y + 4,
          'text-anchor': 'end',
          fill: 'var(--muted-foreground)',
          'font-size': '10',
          'font-family': 'var(--font-sans)',
        });
        label.textContent = Utils.compact(Math.round(value));
        svg.appendChild(label);
      }

      /* --- x axis labels --- */
      const labelEvery = labels.length > 12 ? 2 : 1;
      labels.forEach((label, index) => {
        if (index % labelEvery !== 0 && index !== labels.length - 1) return;
        const text = el('text', {
          x: xAt(index),
          y: height - 8,
          'text-anchor': 'middle',
          fill: 'var(--muted-foreground)',
          'font-size': '10',
          'font-family': 'var(--font-sans)',
        });
        text.textContent = formatLabel(label);
        svg.appendChild(text);
      });

      /* --- series --- */
      const defs = el('defs');
      svg.appendChild(defs);

      series.forEach((s, seriesIndex) => {
        const color = s.color || `var(--chart-${(seriesIndex % 5) + 1})`;
        const gradientId = `grad-${seriesIndex}-${Math.random().toString(36).slice(2, 8)}`;

        if (s.type === 'area') {
          const gradient = el('linearGradient', {
            id: gradientId,
            x1: '0',
            y1: '0',
            x2: '0',
            y2: '1',
          });
          gradient.appendChild(el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.28' }));
          gradient.appendChild(el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0.02' }));
          defs.appendChild(gradient);
        }

        const points = s.data.map((value, index) => `${xAt(index)},${yAt(value)}`);
        const linePath = `M ${points.join(' L ')}`;

        if (s.type === 'area') {
          const areaPath = `${linePath} L ${xAt(s.data.length - 1)},${pad.top + innerH} L ${xAt(0)},${
            pad.top + innerH
          } Z`;
          svg.appendChild(
            el('path', { d: areaPath, fill: `url(#${gradientId})`, stroke: 'none' })
          );
        }

        svg.appendChild(
          el('path', {
            d: linePath,
            fill: 'none',
            stroke: color,
            'stroke-width': 2,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          })
        );

        s.data.forEach((value, index) => {
          svg.appendChild(
            el('circle', {
              cx: xAt(index),
              cy: yAt(value),
              r: 3,
              fill: 'var(--card)',
              stroke: color,
              'stroke-width': 2,
            })
          );
        });
      });

      /* --- hover guide + tooltip --- */
      const guide = el('line', {
        y1: pad.top,
        y2: pad.top + innerH,
        stroke: 'var(--ring)',
        'stroke-width': 1,
        'stroke-dasharray': '4 4',
        opacity: '0',
      });
      svg.appendChild(guide);

      svg.addEventListener('mousemove', (event) => {
        const rect = svg.getBoundingClientRect();
        const scale = width / rect.width;
        const mouseX = (event.clientX - rect.left) * scale;
        const index = Math.max(0, Math.min(labels.length - 1, Math.round((mouseX - pad.left) / xStep)));

        guide.setAttribute('x1', xAt(index));
        guide.setAttribute('x2', xAt(index));
        guide.setAttribute('opacity', '1');

        const rows = series
          .map(
            (s) =>
              `<span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${
                s.color || 'var(--chart-1)'
              };margin-right:6px;"></i>${Utils.escape(s.name)}: <b>${formatValue(s.data[index])}</b></span>`
          )
          .join('');
        tip.innerHTML = `<strong>${Utils.escape(labels[index])}</strong>${rows}`;
        tip.classList.add('visible');

        const left = (xAt(index) / width) * rect.width;
        tip.style.left = `${Math.min(Math.max(left - 50, 0), rect.width - 120)}px`;
        tip.style.top = '8px';
      });

      svg.addEventListener('mouseleave', () => {
        guide.setAttribute('opacity', '0');
        tip.classList.remove('visible');
      });

      host.appendChild(svg);
    };

    render();

    if (host._chartResize) window.removeEventListener('resize', host._chartResize);
    host._chartResize = Utils.debounce(render, 150);
    window.addEventListener('resize', host._chartResize);
  }

  /* ---------------------------------------------------------------------
   * Doughnut chart
   * ------------------------------------------------------------------- */
  function doughnut(host, options) {
    if (!host) return;

    const { labels = [], data = [], colors = [], formatValue = (v) => Utils.number(v) } = options;

    const render = () => {
      const size = Math.max(host.clientWidth || 200, 160);
      host.querySelectorAll('svg').forEach((node) => node.remove());
      const tip = tooltipFor(host);

      const svg = el('svg', {
        class: 'chart',
        viewBox: `0 0 ${size} ${size}`,
        width: '100%',
        height: '100%',
        style: 'height:auto;max-height:15rem;',
      });

      const total = data.reduce((sum, value) => sum + (Number(value) || 0), 0);
      const radius = size / 2 - 12;
      const inner = radius * 0.62;
      const center = size / 2;

      if (!total) {
        host.appendChild(svg);
        return;
      }

      let startAngle = -Math.PI / 2;
      data.forEach((value, index) => {
        const amount = Number(value) || 0;
        const angle = (amount / total) * Math.PI * 2;
        const endAngle = startAngle + angle;
        const color = colors[index] || `var(--chart-${(index % 5) + 1})`;

        const large = angle > Math.PI ? 1 : 0;
        const p1 = [
          center + radius * Math.cos(startAngle),
          center + radius * Math.sin(startAngle),
        ];
        const p2 = [center + radius * Math.cos(endAngle), center + radius * Math.sin(endAngle)];
        const p3 = [center + inner * Math.cos(endAngle), center + inner * Math.sin(endAngle)];
        const p4 = [center + inner * Math.cos(startAngle), center + inner * Math.sin(startAngle)];

        const d = [
          `M ${p1[0]} ${p1[1]}`,
          `A ${radius} ${radius} 0 ${large} 1 ${p2[0]} ${p2[1]}`,
          `L ${p3[0]} ${p3[1]}`,
          `A ${inner} ${inner} 0 ${large} 0 ${p4[0]} ${p4[1]}`,
          'Z',
        ].join(' ');

        const path = el('path', {
          d,
          fill: color,
          stroke: 'var(--card)',
          'stroke-width': 2,
          cursor: 'pointer',
        });

        path.addEventListener('mouseenter', (event) => {
          const rect = svg.getBoundingClientRect();
          tip.innerHTML = `<strong>${Utils.escape(labels[index] || '')}</strong><span>${formatValue(
            amount
          )} · ${((amount / total) * 100).toFixed(1)}%</span>`;
          tip.classList.add('visible');
          tip.style.left = `${event.clientX - rect.left - 40}px`;
          tip.style.top = `${event.clientY - rect.top - 40}px`;
        });
        path.addEventListener('mouseleave', () => tip.classList.remove('visible'));

        svg.appendChild(path);
        startAngle = endAngle;
      });

      const totalText = el('text', {
        x: center,
        y: center - 2,
        'text-anchor': 'middle',
        fill: 'var(--foreground)',
        'font-size': '22',
        'font-weight': '600',
        'font-family': 'var(--font-sans)',
      });
      totalText.textContent = Utils.compact(total);
      svg.appendChild(totalText);

      const totalLabel = el('text', {
        x: center,
        y: center + 14,
        'text-anchor': 'middle',
        fill: 'var(--muted-foreground)',
        'font-size': '11',
        'font-family': 'var(--font-sans)',
      });
      totalLabel.textContent = 'Total';
      svg.appendChild(totalLabel);

      host.appendChild(svg);
    };

    render();
    if (host._chartResize) window.removeEventListener('resize', host._chartResize);
    host._chartResize = Utils.debounce(render, 150);
    window.addEventListener('resize', host._chartResize);
  }

  return { area, doughnut };
})();

window.Charts = Charts;
