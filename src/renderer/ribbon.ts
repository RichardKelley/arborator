interface NodeType {
    name: string;
    type: string;
    has_children: boolean;
}

interface NodeTypes {
    [key: string]: NodeType[] | NodeType;
}

async function initializeRibbon() {
    try {
        const nodeTypes: NodeTypes = await window.electronAPI.getNodeTypes();
        const ribbon = document.querySelector('.ribbon');
        
        if (!ribbon) {
            throw new Error('Ribbon element not found');
        }

        // Clear existing ribbon content
        ribbon.innerHTML = '';

        // Create a group for each category in nodeTypes
        for (const [category, nodes] of Object.entries(nodeTypes)) {
            const group = document.createElement('div');
            group.className = 'ribbon-group';

            const content = document.createElement('div');
            content.className = 'ribbon-group-content';

            // Handle both single nodes and arrays of nodes
            const nodeArray = Array.isArray(nodes) ? nodes : [nodes];
            
            // Always add label, but empty for single nodes
            const label = document.createElement('div');
            label.className = 'ribbon-group-label';
            label.textContent = Array.isArray(nodes) ? category.charAt(0).toUpperCase() + category.slice(1) : '';
            group.appendChild(label);

            // Create a button for each node type
            nodeArray.forEach(node => {
                if (!node.name) {
                    return;
                }
                
                const button = document.createElement('button');
                button.className = 'ribbon-button';
                button.textContent = node.name;
                button.dataset.type = node.type;
                button.onclick = () => (window as any).canvasManager.addNode(node.type, node.name, node.has_children);
                content.appendChild(button);
            });

            group.appendChild(content);
            ribbon.appendChild(group);
        }
    } catch (error) {
        console.error('Failed to initialize ribbon:', error);
    }
}

// Wait for DOM content to be loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRibbon);
} else {
    initializeRibbon();
} 