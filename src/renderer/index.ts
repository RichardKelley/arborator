// Theme management
console.log('Renderer script loaded');

async function initializeTheme() {
    console.log('Initializing theme...');
    
    // Check if there's a saved theme preference
    const savedTheme = localStorage.getItem('theme');
    console.log('Saved theme:', savedTheme);
    
    const isDark = savedTheme === 'dark';
    console.log('Is dark mode?', isDark);
    
    try {
        // Sync with main process
        await (window as any).electronAPI.setThemeState(isDark);
        
        // Apply theme to document
        applyTheme(isDark);

        // Listen for theme changes from the main process
        (window as any).electronAPI.onThemeChanged((isDark: boolean) => {
            console.log('Theme changed to:', isDark ? 'dark' : 'light');
            applyTheme(isDark);
            // Redraw the canvas to update highlighted elements
            (window as any).canvasManager?.draw();
        });
    } catch (err) {
        console.error('Theme initialization error:', err);
    }
}

function applyTheme(isDark: boolean) {
    try {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
        console.log('Theme applied:', isDark ? 'dark' : 'light');
        console.log('Current data-theme attribute:', document.documentElement.getAttribute('data-theme'));
    } catch (err) {
        console.error('Error applying theme:', err);
    }
}

// Initialize when the document is ready
console.log('Setting up DOMContentLoaded listener');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    initializeTheme().catch(err => console.error('Failed to initialize theme:', err));

    // Set up select all handler
    (window as any).electronAPI.onSelectAll(() => {
        if ((window as any).canvasManager) {
            (window as any).canvasManager.selectAll();
        }
    });

    // Set up delete handler
    (window as any).electronAPI.onDelete(() => {
        if ((window as any).canvasManager) {
            const numSelectedNodes = (window as any).canvasManager.selectedNodes.size;
            const numSelectedConnections = (window as any).canvasManager.selectedConnections.size;
            
            if (numSelectedNodes > 0 || numSelectedConnections > 0) {
                (window as any).canvasManager.deleteSelectedNodes();
                (window as any).canvasManager.deleteSelectedConnections();
            }
        }
    });
});