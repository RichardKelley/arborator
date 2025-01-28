interface NodeType {
    name: string;
    type: string;
    has_children: boolean;
}

interface NodeTypes {
    [key: string]: NodeType[] | NodeType;
}

type TabType = 'nodes' | 'file' | 'blackboard' | 'functions';

// Keep track of function buttons
const functionButtons: { name: string, nodeId: string }[] = [];

function addFunctionButton(name: string, nodeId: string) {
    // Check if a button with this name or nodeId already exists
    if (functionButtons.some(btn => btn.name === name || btn.nodeId === nodeId)) {
        // Show error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'A function already exists for this tree';
        errorMessage.style.position = 'fixed';
        errorMessage.style.top = '20px';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translateX(-50%)';
        errorMessage.style.backgroundColor = '#ff4444';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '10px 20px';
        errorMessage.style.borderRadius = '5px';
        errorMessage.style.zIndex = '1000';
        document.body.appendChild(errorMessage);
        setTimeout(() => document.body.removeChild(errorMessage), 3000);
        return;
    }

    // Add to our list of function buttons
    functionButtons.push({ name, nodeId });
    
    // If we're currently on the functions tab, refresh it
    const activeTab = document.querySelector('.ribbon-tab.active') as HTMLDivElement;
    if (activeTab?.dataset.tab === 'functions') {
        const ribbon = document.querySelector('.ribbon');
        if (ribbon) {
            const content = document.createElement('div');
            content.className = 'ribbon-content';
            createFunctionsButtons(content);
            ribbon.innerHTML = '';
            ribbon.appendChild(content);
        }
    }
}

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
                const canvasManager = (window as any).canvasManager;
                if (canvasManager.hasContent()) {
                    const shouldSave = await window.electronAPI.showSaveConfirmation();
                    if (shouldSave === 'save') {
                        await canvasManager.save();
                    } else if (shouldSave === 'cancel') {
                        return;
                    }
                }
                const success = await canvasManager.open();
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

    // Create export group
    const exportGroup = document.createElement('div');
    exportGroup.className = 'ribbon-group';

    const exportLabel = document.createElement('div');
    exportLabel.className = 'ribbon-group-label';
    exportLabel.textContent = 'Export';
    
    const exportGroupContent = document.createElement('div');
    exportGroupContent.className = 'ribbon-group-content';

    const exportButtons = [
        { name: 'Export Canvas', action: async () => {
            try {
                const canvasManager = (window as any).canvasManager;
                if (!canvasManager) {
                    throw new Error('Canvas manager not found');
                }

                // Find all nodes that have configs
                const nodesWithConfigs = canvasManager.nodes.filter((node: any) => 
                    node.configs && node.configs.length > 0 && node.configValues
                );

                // Create a mapping of configs with unique IDs
                const configsMap: { [key: string]: any } = {};
                const nodeConfigMap = new Map<string, { [key: string]: string }>();  // Map node IDs to their config type->id mapping

                nodesWithConfigs.forEach((node: any) => {
                    if (node.configValues) {
                        const configMapping: { [key: string]: string } = {};
                        Object.entries(node.configValues).forEach(([configType, configData]) => {
                            // Create a unique ID for this config
                            const configId = Math.random().toString(36).substr(2, 9);
                            configsMap[configId] = {
                                type: configType,
                                values: configData as { [key: string]: any }
                            };
                            configMapping[configType] = configId;
                        });
                        nodeConfigMap.set(node.id, configMapping);
                    }
                });

                // Find all blackboard nodes
                const blackboardNodes = canvasManager.nodes.filter((node: any) => node.type === 'blackboard');
                
                // Create blackboards mapping
                const blackboardsMap: { [key: string]: any } = {};
                blackboardNodes.forEach((node: any) => {
                    const blackboardName = node.customName || 'default';
                    blackboardsMap[blackboardName] = node.blackboardData || {};
                });

                // Find all root nodes
                const rootNodes = canvasManager.nodes.filter((node: any) => node.type === 'root');
                
                // Helper function to get children sorted by x-coordinate
                const getSortedChildren = (node: any) => {
                    const children = canvasManager.getNodeChildren(node)
                        .filter((child: any) => child.type !== 'blackboard');  // Exclude blackboard nodes
                    return children.sort((a: any, b: any) => a.x - b.x);
                };

                // Helper function to create tree structure recursively
                const createTreeStructure = (node: any) => {
                    const nodeData: any = {
                        type: node.type,
                        name: node.name
                    };

                    // Add custom name and type if they exist
                    if (node.customName) {
                        nodeData.custom_name = node.customName;
                    }
                    if (node.customType) {
                        nodeData.custom_type = node.customType;
                    }

                    // If this is a root node, find its associated blackboard
                    if (node.type === 'root') {
                        nodeData.blackboard = null;  // Default to null if no blackboard is found
                        const children = canvasManager.getNodeChildren(node);
                        const blackboardNode = children.find((child: any) => child.type === 'blackboard');
                        if (blackboardNode) {
                            nodeData.blackboard = blackboardNode.customName || 'default';
                        }
                    }

                    // Add config references if this node has configs
                    if (nodeConfigMap.has(node.id)) {
                        const configMapping = nodeConfigMap.get(node.id);
                        nodeData.configs = configMapping;
                    }

                    // Recursively process children in left-to-right order
                    const children = getSortedChildren(node);
                    if (children.length > 0) {
                        nodeData.children = children.map((child: any) => createTreeStructure(child));
                    }

                    return nodeData;
                };

                // Create trees object with a tree for each root node
                const treesMap: { [key: string]: any } = {};
                rootNodes.forEach((rootNode: any, index: number) => {
                    const treeName = rootNode.customName || `tree_${index + 1}`;
                    treesMap[treeName] = createTreeStructure(rootNode);
                });

                // Create the export data structure
                const exportData = {
                    configs: configsMap,
                    blackboards: blackboardsMap,
                    trees: treesMap
                };

                // Convert to JSON string with pretty printing
                const jsonData = JSON.stringify(exportData, null, 2);

                // Save the file using the electron API
                const filePath = await window.electronAPI.exportCanvas(jsonData);
                if (filePath) {
                    console.log(`Canvas exported successfully to ${filePath}`);
                }
            } catch (error) {
                console.error('Failed to export canvas:', error);
            }
        }},
        { name: 'Export Trees', action: async () => {
            try {
                const canvasManager = (window as any).canvasManager;
                if (!canvasManager) {
                    throw new Error('Canvas manager not found');
                }

                // Find all nodes that have configs
                const nodesWithConfigs = canvasManager.nodes.filter((node: any) => 
                    node.configs && node.configs.length > 0 && node.configValues
                );

                // Create a mapping of configs with unique IDs
                const configsMap: { [key: string]: any } = {};
                const nodeConfigMap = new Map<string, { [key: string]: string }>();  // Map node IDs to their config type->id mapping

                nodesWithConfigs.forEach((node: any) => {
                    if (node.configValues) {
                        const configMapping: { [key: string]: string } = {};
                        Object.entries(node.configValues).forEach(([configType, configData]) => {
                            // Create a unique ID for this config
                            const configId = Math.random().toString(36).substr(2, 9);
                            configsMap[configId] = {
                                type: configType,
                                values: configData as { [key: string]: any }
                            };
                            configMapping[configType] = configId;
                        });
                        nodeConfigMap.set(node.id, configMapping);
                    }
                });

                // Find all root nodes
                const rootNodes = canvasManager.nodes.filter((node: any) => node.type === 'root');
                
                // Helper function to get children sorted by x-coordinate
                const getSortedChildren = (node: any) => {
                    const children = canvasManager.getNodeChildren(node)
                        .filter((child: any) => child.type !== 'blackboard');  // Exclude blackboard nodes
                    return children.sort((a: any, b: any) => a.x - b.x);
                };

                // Helper function to create tree structure recursively
                const createTreeStructure = (node: any) => {
                    const nodeData: any = {
                        type: node.type,
                        name: node.name
                    };

                    // Add custom name and type if they exist
                    if (node.customName) {
                        nodeData.custom_name = node.customName;
                    }
                    if (node.customType) {
                        nodeData.custom_type = node.customType;
                    }

                    // If this is a root node, find its associated blackboard
                    if (node.type === 'root') {
                        nodeData.blackboard = null;  // Default to null if no blackboard is found
                        const children = canvasManager.getNodeChildren(node);
                        const blackboardNode = children.find((child: any) => child.type === 'blackboard');
                        if (blackboardNode) {
                            nodeData.blackboard = blackboardNode.customName || 'default';
                        }
                    }

                    // Add config references if this node has configs
                    if (nodeConfigMap.has(node.id)) {
                        const configMapping = nodeConfigMap.get(node.id);
                        nodeData.configs = configMapping;
                    }

                    // Recursively process children in left-to-right order
                    const children = getSortedChildren(node);
                    if (children.length > 0) {
                        nodeData.children = children.map((child: any) => createTreeStructure(child));
                    }

                    return nodeData;
                };

                // Create trees object with a tree for each root node
                const treesMap: { [key: string]: any } = {};
                rootNodes.forEach((rootNode: any, index: number) => {
                    const treeName = rootNode.customName || `tree_${index + 1}`;
                    treesMap[treeName] = createTreeStructure(rootNode);
                });

                // Create the export data structure
                const exportData = {
                    configs: configsMap,
                    trees: treesMap
                };

                // Convert to JSON string with pretty printing
                const jsonData = JSON.stringify(exportData, null, 2);

                // Save the file using the electron API
                const filePath = await window.electronAPI.exportTrees(jsonData);
                if (filePath) {
                    console.log(`Trees exported successfully to ${filePath}`);
                }
            } catch (error) {
                console.error('Failed to export trees:', error);
            }
        }},
        { name: 'Export Blackboards', action: async () => {
            try {
                const canvasManager = (window as any).canvasManager;
                if (!canvasManager) {
                    throw new Error('Canvas manager not found');
                }

                // Find all blackboard nodes
                const blackboardNodes = canvasManager.nodes.filter((node: any) => node.type === 'blackboard');
                
                if (blackboardNodes.length === 0) {
                    console.log('No blackboards found to export');
                    return;
                }

                // Format the blackboards data
                const blackboardsData = blackboardNodes.map((node: any) => ({
                    name: node.customName || 'default',
                    kv: node.blackboardData || {}
                }));

                // Convert to JSON string with pretty printing
                const jsonData = JSON.stringify(blackboardsData, null, 2);

                // Save the file using the electron API
                const filePath = await window.electronAPI.saveBlackboards(jsonData);
                if (filePath) {
                    console.log(`Blackboards exported successfully to ${filePath}`);
                }
            } catch (error) {
                console.error('Failed to export blackboards:', error);
            }
        }}
    ];

    exportButtons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'ribbon-button';
        button.textContent = btn.name;
        button.onclick = btn.action;
        // Add tooltips for export operations
        switch (btn.name) {
            case 'Export Canvas':
                button.title = 'Export both trees and blackboards';
                break;
            case 'Export Trees':
                button.title = 'Export trees, ignoring blackboards';
                break;
            case 'Export Blackboards':
                button.title = 'Export blackboards, ignoring trees';
                break;
        }
        exportGroupContent.appendChild(button);
    });

    exportGroup.appendChild(exportLabel);
    exportGroup.appendChild(exportGroupContent);
    content.appendChild(exportGroup);
}

function createNodeButtons(content: HTMLElement, nodeTypes: NodeTypes) {
    // Create a group for each category in nodeTypes
    for (const [category, nodes] of Object.entries(nodeTypes)) {
        // Skip the blackboard node
        if (category === 'blackboard') continue;

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

function createFunctionsButtons(content: HTMLElement) {
    const group = document.createElement('div');
    group.className = 'ribbon-group';

    const label = document.createElement('div');
    label.className = 'ribbon-group-label';
    label.textContent = 'Functions';
    
    const groupContent = document.createElement('div');
    groupContent.className = 'ribbon-group-content';

    // Add a button for each function
    functionButtons.forEach(({ name, nodeId }) => {
        // Create button container for button and delete 'x'
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'ribbon-button-container';
        buttonContainer.style.position = 'relative';
        buttonContainer.style.display = 'inline-block';
        buttonContainer.style.marginRight = '2px';  // Small spacing between buttons

        // Create main function button
        const button = document.createElement('button');
        button.className = 'ribbon-button';
        button.style.paddingRight = '36px';  // 20px spacing + 16px for 'x'
        button.style.paddingLeft = '8px';    // Less padding on the left
        button.style.paddingTop = '4px';     // Reduced vertical padding
        button.style.paddingBottom = '4px';  // Reduced vertical padding
        button.textContent = name;
        button.onclick = () => {
            const canvasManager = (window as any).canvasManager;
            if (canvasManager) {
                canvasManager.instantiateFunction(nodeId);
            }
        };

        // Create delete button
        const deleteButton = document.createElement('div');
        deleteButton.className = 'ribbon-button-delete';
        deleteButton.textContent = '×';
        deleteButton.style.position = 'absolute';
        deleteButton.style.right = '4px';    // Slightly closer to the edge
        deleteButton.style.top = '50%';
        deleteButton.style.transform = 'translateY(-50%)';
        deleteButton.style.width = '16px';    // Back to original size
        deleteButton.style.height = '16px';   // Back to original size
        deleteButton.style.lineHeight = '16px'; // Match height
        deleteButton.style.textAlign = 'center';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.borderRadius = '50%';
        deleteButton.style.backgroundColor = 'var(--ribbon-button-bg)';
        deleteButton.style.color = 'var(--text-color)';
        deleteButton.style.fontSize = '14px';  // Back to original size
        deleteButton.style.fontWeight = 'bold';

        // Add hover effect
        deleteButton.addEventListener('mouseover', () => {
            deleteButton.style.backgroundColor = 'var(--ribbon-button-hover-bg)';
        });
        deleteButton.addEventListener('mouseout', () => {
            deleteButton.style.backgroundColor = 'var(--ribbon-button-bg)';
        });

        // Handle delete click
        deleteButton.onclick = (e) => {
            e.stopPropagation(); // Prevent triggering the main button click

            // Create confirmation modal
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.backgroundColor = 'var(--modal-overlay-bg)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '1000';

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.backgroundColor = 'var(--bg-color)';
            modal.style.padding = '20px';
            modal.style.borderRadius = '4px';
            modal.style.minWidth = '300px';

            const title = document.createElement('h3');
            title.style.margin = '0 0 15px 0';
            title.textContent = 'Delete Function';

            const message = document.createElement('p');
            message.style.margin = '0 0 20px 0';
            message.textContent = `Are you sure you want to delete the function "${name}"?`;

            const buttons = document.createElement('div');
            buttons.style.display = 'flex';
            buttons.style.justifyContent = 'flex-end';
            buttons.style.gap = '10px';

            const noButton = document.createElement('button');
            noButton.className = 'modal-button modal-button-secondary';
            noButton.textContent = 'No';
            noButton.onclick = () => document.body.removeChild(overlay);

            const yesButton = document.createElement('button');
            yesButton.className = 'modal-button modal-button-primary';
            yesButton.textContent = 'Yes';
            yesButton.onclick = () => {
                // Remove the function from our list
                const index = functionButtons.findIndex(btn => btn.nodeId === nodeId);
                if (index !== -1) {
                    functionButtons.splice(index, 1);
                }

                // Remove the template from canvas manager
                const canvasManager = (window as any).canvasManager;
                if (canvasManager) {
                    canvasManager.deleteFunctionTemplate(nodeId);
                }

                // Refresh the functions tab
                const content = document.createElement('div');
                content.className = 'ribbon-content';
                createFunctionsButtons(content);
                const ribbon = document.querySelector('.ribbon');
                if (ribbon) {
                    ribbon.innerHTML = '';
                    ribbon.appendChild(content);
                }

                document.body.removeChild(overlay);
            };

            buttons.appendChild(noButton);
            buttons.appendChild(yesButton);

            modal.appendChild(title);
            modal.appendChild(message);
            modal.appendChild(buttons);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        };

        buttonContainer.appendChild(button);
        buttonContainer.appendChild(deleteButton);
        groupContent.appendChild(buttonContainer);
    });

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
        case 'functions':
            createFunctionsButtons(content);
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
        
        const tabNames: TabType[] = ['file', 'nodes', 'blackboard', 'functions'];
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

// Export the addFunctionButton function globally
(window as any).ribbon = { addFunctionButton }; 