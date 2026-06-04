/**
 * Resizable Panels Logic
 * Handles the dragging of the resizer to adjust panel widths
 */
document.addEventListener('DOMContentLoaded', () => {
    const resizer = document.getElementById('panelResizer');
    const rightPanel = document.getElementById('formPanel');
    const container = document.querySelector('.main');

    if (!resizer || !rightPanel || !container) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        
        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        // The width of the right panel is the distance from the mouse to the right edge of the container
        let newWidth = containerRect.right - e.clientX;

        // Apply constraints (min/max widths are handled by CSS but we can enforce them here too)
        if (newWidth < 300) newWidth = 300;
        if (newWidth > 800) newWidth = 800;

        rightPanel.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });
});
