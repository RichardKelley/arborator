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
        { name: 'New', action: async () => {
            try {
                await (window as any).canvasManager.handleNew();
            } catch (error) {
                console.error('Failed to handle new action:', error);
            }
        }},
        { name: 'Open', action: async () => {
            try {
                const success = await (window as any).canvasManager.open();
                if (success) {
                    console.log('Tree loaded successfully');
                }
            } catch (error) {
                console.error('Failed to open tree:', error);
            }
        }},
        { name: 'Add Tree', action: async () => {
            try {
                const success = await (window as any).canvasManager.addTreeFromFile();
                if (success) {
                    console.log('Tree added successfully');
                }
            } catch (error) {
                console.error('Failed to add tree:', error);
            }
        }},
        { name: 'Save', action: async () => {
            try {
                const filePath = await (window as any).canvasManager.save();
                if (filePath) {
                    console.log(`Tree saved successfully to ${filePath}`);
                }
            } catch (error) {
                console.error('Failed to save tree:', error);
            }
        }}
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'ribbon-button';
        button.textContent = btn.name;
        button.onclick = btn.action;
        // Add tooltips for file operations
        switch (btn.name) {
            case 'New':
                button.title = 'Clear canvas and create a new behavior tree';
                break;
            case 'Open':
                button.title = 'Clear canvas and open an existing behavior tree';
                break;
            case 'Add Tree':
                button.title = 'Add a behavior tree from a file to the current canvas';
                break;
            case 'Save':
                button.title = 'Save the current canvas to a file';
                break;
        }
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
            button.textContent = node.name === 'CustomAction' || node.name === 'CustomCondition' ? 'Custom' : node.name;
            button.dataset.type = node.type;
            
            // Add tooltips based on node type
            switch (node.type) {
                case 'root':
                    button.title = 'Root node - The starting point of the behavior tree';
                    break;
                case 'action':
                    if (node.name === 'CustomAction') {
                        button.title = 'Create a custom action node';
                    } else if (node.name === 'GenerateAction') {
                        button.title = 'Generate text using an LLM';
                    } else if (node.name === 'LogLikelihoodAction') {
                        button.title = 'Calculate LLM probabilities of several completions of a string';
                    } else if (node.name === 'LogLikelihoodRollingAction') {
                        button.title = 'Calculate LLM probability of a single string';
                    }
                    break;
                case 'condition':
                    if (node.name === 'CustomCondition') {
                        button.title = 'Create a custom condition node';
                    } else if (node.name === 'LMCompletionCondition') {
                        button.title = 'Check a condition using an LLM';
                    }
                    break;
                case 'control':
                    if (node.name === 'Fallback') {
                        button.title = 'Execute children in sequence until one succeeds';
                    } else if (node.name === 'Sequence') {
                        button.title = 'Execute children in sequence until one fails';
                    }
                    break;
                case 'decorator':
                    switch (node.name) {
                        case 'Inverter':
                            button.title = 'Invert the result of child node';
                            break;
                        case 'Repeat':
                            button.title = 'Repeatedly execute child node';
                            break;
                        case 'Retry':
                            button.title = 'Retry child node on failure';
                            break;
                        case 'RunOnce':
                            button.title = 'Runs child exactly once';
                            break;
                        case 'Timeout':
                            button.title = 'Limit the execution time of child node';
                            break;
                        case 'History':
                            button.title = 'Track the updates to a blackboard entry';
                            break;
                        case 'ForceFailure':
                            button.title = 'Return failure regardless of child result';
                            break;
                        case 'ForceSuccess':
                            button.title = 'Return success regardless of child result';
                            break;
                    }
                    break;
            }
            
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

function createCustomButtons(content: HTMLElement) {
    const group = document.createElement('div');
    group.className = 'ribbon-group';

    const label = document.createElement('div');
    label.className = 'ribbon-group-label';
    label.textContent = 'Custom';
    
    const groupContent = document.createElement('div');
    groupContent.className = 'ribbon-group-content';

    // Create CustomAction button
    const actionButton = document.createElement('button');
    actionButton.className = 'ribbon-button';
    actionButton.textContent = 'Custom';
    actionButton.dataset.type = 'action';
    actionButton.onclick = () => {
        const canvasManager = (window as any).canvasManager;
        if (canvasManager) {
            canvasManager.addNode('action', 'CustomAction', false)
                .catch((error: Error) => console.error('Failed to add CustomAction node:', error));
        }
    };
    
    // Create CustomCondition button
    const conditionButton = document.createElement('button');
    conditionButton.className = 'ribbon-button';
    conditionButton.textContent = 'Custom';
    conditionButton.dataset.type = 'condition';
    conditionButton.onclick = () => {
        const canvasManager = (window as any).canvasManager;
        if (canvasManager) {
            canvasManager.addNode('condition', 'CustomCondition', false)
                .catch((error: Error) => console.error('Failed to add CustomCondition node:', error));
        }
    };
    
    groupContent.appendChild(actionButton);
    groupContent.appendChild(conditionButton);
    group.appendChild(label);
    group.appendChild(groupContent);
    content.appendChild(group);
}

function createBlackboardButtons(content: HTMLElement) {
    const group = document.createElement('div');
    group.className = 'ribbon-group';

    const label = document.createElement('div');
    label.className = 'ribbon-group-label';
    label.textContent = 'Blackboard';
    
    const groupContent = document.createElement('div');
    groupContent.className = 'ribbon-group-content';

    const button = document.createElement('button');
    button.className = 'ribbon-button';
    button.textContent = 'New Blackboard';
    button.title = 'Create a new blackboard node';
    button.onclick = () => {
        const canvasManager = (window as any).canvasManager;
        if (canvasManager) {
            canvasManager.addNode('blackboard', 'Blackboard', false)
                .catch((error: Error) => console.error('Failed to add blackboard node:', error));
        }
    };
    
    groupContent.appendChild(button);
    group.appendChild(label);
    group.appendChild(groupContent);
    content.appendChild(group);
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
            createBlackboardButtons(content);
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