interface NodeType {
    name: string;
    type: string;
    has_children: boolean;
}

interface NodeTypes {
    [key: string]: NodeType[] | NodeType;
}

type TabType = 'nodes' | 'file' | 'blackboard';

function createFileButtons(content: HTMLElement) {
    const group = document.createElement('div');
    group.className = 'ribbon-group';

    const label = document.createElement('div');
    label.className = 'ribbon-group-label';
    label.textContent = 'File';
    
    const groupContent = document.createElement('div');
    groupContent.className = 'ribbon-group-content';

    const buttons = [
        { name: 'New', action: () => console.log('New clicked') },
        { name: 'Open', action: () => console.log('Open clicked') },
        { name: 'Save', action: () => console.log('Save clicked') }
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'ribbon-button';
        button.textContent = btn.name;
        button.onclick = btn.action;
        groupContent.appendChild(button);
    });

    group.appendChild(label);
    group.appendChild(groupContent);
    content.appendChild(group);
}

function createNodeButtons(content: HTMLElement, nodeTypes: NodeTypes) {
    // Create a group for each category in nodeTypes
    for (const [category, nodes] of Object.entries(nodeTypes)) {
        const group = document.createElement('div');
        group.className = 'ribbon-group';

        // Always add label, but empty for single nodes
        const label = document.createElement('div');
        label.className = 'ribbon-group-label';
        label.textContent = category === 'root' ? 'Tree' : 
                          Array.isArray(nodes) ? category.charAt(0).toUpperCase() + category.slice(1) : '';

        const groupContent = document.createElement('div');
        groupContent.className = 'ribbon-group-content';

        // Handle both single nodes and arrays of nodes
        const nodeArray = Array.isArray(nodes) ? nodes : [nodes];
        
        // Create a button for each node type
        nodeArray.forEach(node => {
            if (!node.name) {
                return;
            }
            
            const button = document.createElement('button');
            button.className = 'ribbon-button';
            button.textContent = node.name;
            button.dataset.type = node.type;
            button.onclick = () => {
                const canvasManager = (window as any).canvasManager;
                if (canvasManager) {
                    canvasManager.addNode(node.type, node.name, node.has_children)
                        .catch((error: Error) => console.error('Failed to add node:', error));
                }
            };
            groupContent.appendChild(button);
        });

        group.appendChild(label);
        group.appendChild(groupContent);
        content.appendChild(group);
    }
}

function switchTab(tab: TabType, nodeTypes: NodeTypes) {
    const ribbon = document.querySelector('.ribbon');
    if (!ribbon) return;

    // Update tab styling
    document.querySelectorAll('.ribbon-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

    // Clear existing ribbon content
    ribbon.innerHTML = '';

    // Create content div
    const content = document.createElement('div');
    content.className = 'ribbon-content';

    // Add appropriate buttons based on tab
    switch (tab) {
        case 'nodes':
            createNodeButtons(content, nodeTypes);
            break;
        case 'file':
            createFileButtons(content);
            break;
        case 'blackboard':
            // Empty for now
            break;
    }

    ribbon.appendChild(content);
}

async function initializeRibbon() {
    try {
        const nodeTypes: NodeTypes = await window.electronAPI.getNodeTypes();
        
        // Create ribbon container
        const container = document.createElement('div');
        container.className = 'ribbon-container';
        
        // Create tabs
        const tabs = document.createElement('div');
        tabs.className = 'ribbon-tabs';
        
        const tabNames: TabType[] = ['file', 'nodes', 'blackboard'];
        tabNames.forEach(tabName => {
            const tab = document.createElement('div');
            tab.className = 'ribbon-tab';
            tab.textContent = tabName;
            tab.dataset.tab = tabName;
            tab.onclick = () => switchTab(tabName, nodeTypes);
            tabs.appendChild(tab);
        });

        // Create ribbon
        const ribbon = document.createElement('div');
        ribbon.className = 'ribbon';

        // Add everything to the container
        container.appendChild(tabs);
        container.appendChild(ribbon);

        // Replace the existing ribbon with our new container
        const oldRibbon = document.querySelector('.ribbon');
        if (oldRibbon && oldRibbon.parentNode) {
            oldRibbon.parentNode.replaceChild(container, oldRibbon);
        }

        // Initialize with nodes tab
        switchTab('nodes', nodeTypes);
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