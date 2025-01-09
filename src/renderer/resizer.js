document.addEventListener('DOMContentLoaded', () => {
  const resizer = document.getElementById('column-resizer');
  const rightColumn = document.getElementById('right-column');
  let isResizing = false;
  let startX;
  let startWidth;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = rightColumn.offsetWidth;
    resizer.classList.add('dragging');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const width = startWidth - (e.clientX - startX);
    // Set minimum and maximum widths
    const minWidth = 100; // minimum width in pixels
    const maxWidth = window.innerWidth * 0.8; // maximum 80% of window width
    
    if (width >= minWidth && width <= maxWidth) {
      rightColumn.style.width = `${width}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
    resizer.classList.remove('dragging');
  });
}); 