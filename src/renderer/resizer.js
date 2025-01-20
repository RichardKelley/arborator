document.addEventListener('DOMContentLoaded', () => {
  const resizer = document.getElementById('column-resizer');
  const rightColumn = document.getElementById('right-column');
  let isResizing = false;
  let startX;
  let startWidth;

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(getComputedStyle(rightColumn).width, 10);
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const dx = startX - e.clientX;
    const newWidth = startWidth + dx;
    
    // Set minimum and maximum widths
    const minWidth = 300; // increased from 100 to accommodate form fields (140px) + padding + labels
    const maxWidth = window.innerWidth * 0.8; // maximum 80% of window width
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      rightColumn.style.width = `${newWidth}px`;
      // Dispatch a custom event when column is resized
      window.dispatchEvent(new CustomEvent('column-resize'));
    }
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    
    isResizing = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // Dispatch final resize event
    window.dispatchEvent(new CustomEvent('column-resize'));
  });
}); 