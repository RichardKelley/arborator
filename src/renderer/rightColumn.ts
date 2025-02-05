interface NodeConfig {
    id: string;
    name: string;
    type: string;
    has_children: boolean;
    customName?: string;
    customType?: string;
    configs?: string[];
    blackboardData?: { [key: string]: any };
}

class RightColumn {
    private container: HTMLElement;
    private currentNode: NodeConfig | null = null;
    private customNameInput: HTMLInputElement | null = null;
    private customTypeInput: HTMLInputElement | null = null;
    private configsContainer: HTMLElement | null = null;
    private nodeConfigs: { [key: string]: { [key: string]: string } } = {};
    private originalCustomName: string = '';

    constructor() {
        const container = document.getElementById('right-column');
        if (!container) {
            throw new Error('Right column container not found');
        }
        this.container = container;
        this.loadConfigs();
    }

    private async loadConfigs() {
        try {
            this.nodeConfigs = await window.electronAPI.getConfigs();
        } catch (error) {
            console.error('Failed to load configs:', error);
        }
    }

    displayNode(node: NodeConfig) {
        if (!node) return;
        
        this.currentNode = node;
        this.originalCustomName = node.customName || '';
        this.container.innerHTML = '';

        // Title (node type)
        const title = document.createElement('div');
        title.className = 'right-column-title';
        title.textContent = (node.name === 'CustomAction' || node.name === 'CustomCondition') ? node.name : node.name;
        this.container.appendChild(title);

        // Handle blackboard nodes differently
        if (node.type === 'blackboard') {
            this.displayBlackboardTable(node);
            return;
        }

        // Custom type input for CustomAction and CustomCondition nodes
        if (node.name === 'CustomAction' || node.name === 'CustomCondition') {
            const customTypeContainer = document.createElement('div');
            customTypeContainer.className = 'custom-name-container';

            const customTypeLabel = document.createElement('label');
            customTypeLabel.className = 'custom-name-label';
            customTypeLabel.textContent = 'Custom Type';
            customTypeContainer.appendChild(customTypeLabel);

            this.customTypeInput = document.createElement('input');
            this.customTypeInput.className = 'custom-name-input';
            this.customTypeInput.type = 'text';
            this.customTypeInput.value = node.customType || '';
            this.customTypeInput.placeholder = 'Enter the custom type';
            
            // Add event listener for input changes
            this.customTypeInput.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                if (this.currentNode) {
                    (window as any).canvasManager.updateNodeCustomType(this.currentNode.id, target.value);
                }
            });
            
            customTypeContainer.appendChild(this.customTypeInput);
            this.container.appendChild(customTypeContainer);
        }

        // Custom name input
        const customNameContainer = document.createElement('div');
        customNameContainer.className = 'custom-name-container';

        const customNameLabel = document.createElement('label');
        customNameLabel.className = 'custom-name-label';
        customNameLabel.textContent = 'Name';
        customNameContainer.appendChild(customNameLabel);

        this.customNameInput = document.createElement('input');
        this.customNameInput.className = 'custom-name-input';
        this.customNameInput.type = 'text';
        this.customNameInput.value = node.customName || '';
        this.customNameInput.placeholder = 'Enter a name for this node';
        
        // Track original value on focus
        this.customNameInput.addEventListener('focus', (e) => {
            const target = e.target as HTMLInputElement;
            this.originalCustomName = target.value;
        });
        
        // Handle enter key press
        this.customNameInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && this.currentNode) {
                e.preventDefault();
                const target = e.target as HTMLInputElement;
                // Only update if the value is different from the current node's custom name
                if (target.value !== (this.currentNode.customName || '')) {
                    await (window as any).canvasManager.updateNodeCustomName(this.currentNode.id, target.value);
                }
                target.blur(); // Remove focus from input
            }
        });
        
        // Only update if value has changed
        this.customNameInput.addEventListener('blur', async (e) => {
            const target = e.target as HTMLInputElement;
            // Only update if the value is different from the current node's custom name
            if (this.currentNode && target.value !== (this.currentNode.customName || '')) {
                await (window as any).canvasManager.updateNodeCustomName(this.currentNode.id, target.value);
            }
        });
        
        customNameContainer.appendChild(this.customNameInput);
        this.container.appendChild(customNameContainer);

        // Configs
        if (node.configs && node.configs.length > 0) {
            const configsContainer = document.createElement('div');
            configsContainer.className = 'configs-container';
            this.configsContainer = configsContainer;

            node.configs.forEach(configName => {
                const configData = this.nodeConfigs[configName];
                if (configData) {
                    const configSection = this.createConfigSection(configName, configData);
                    configsContainer.appendChild(configSection);
                }
            });

            this.container.appendChild(configsContainer);
        }
    }

    private displayBlackboardTable(node: NodeConfig) {
        // Create name input container
        const customNameContainer = document.createElement('div');
        customNameContainer.className = 'custom-name-container';

        const customNameLabel = document.createElement('label');
        customNameLabel.className = 'custom-name-label';
        customNameLabel.textContent = 'Name';
        customNameContainer.appendChild(customNameLabel);

        this.customNameInput = document.createElement('input');
        this.customNameInput.className = 'custom-name-input';
        this.customNameInput.type = 'text';
        this.customNameInput.value = node.customName || '';
        this.customNameInput.placeholder = 'Enter a name for this blackboard';
        
        // Track original value on focus
        this.customNameInput.addEventListener('focus', (e) => {
            const target = e.target as HTMLInputElement;
            this.originalCustomName = target.value;
        });
        
        // Handle enter key press
        this.customNameInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && this.currentNode) {
                e.preventDefault();
                const target = e.target as HTMLInputElement;
                // Only update if the value is different from the current node's custom name
                if (target.value !== (this.currentNode.customName || '')) {
                    await (window as any).canvasManager.updateNodeCustomName(this.currentNode.id, target.value);
                }
                target.blur(); // Remove focus from input
            }
        });
        
        // Only update if value has changed
        this.customNameInput.addEventListener('blur', async (e) => {
            const target = e.target as HTMLInputElement;
            // Only update if the value is different from the current node's custom name
            if (this.currentNode && target.value !== (this.currentNode.customName || '')) {
                await (window as any).canvasManager.updateNodeCustomName(this.currentNode.id, target.value);
            }
        });
        
        customNameContainer.appendChild(this.customNameInput);
        this.container.appendChild(customNameContainer);

        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'blackboard-table-container';

        // Create table
        const table = document.createElement('table');
        table.className = 'blackboard-table';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Key', 'Value', ''].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');
        
        // Initialize blackboardData if it doesn't exist
        if (!node.blackboardData) {
            node.blackboardData = {};
            (window as any).canvasManager.updateNodeBlackboardData(node.id, node.blackboardData);
        }

        // Add existing data to table
        Object.entries(node.blackboardData).forEach(([key, value]) => {
            const row = this.createTableRow(key, value);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        // Create "Add Row" button
        const addButton = document.createElement('button');
        addButton.className = 'blackboard-add-button';
        addButton.textContent = 'Add Row';
        addButton.onclick = () => {
            const newRow = this.createTableRow('', '');
            tbody.appendChild(newRow);
            // Focus the key input of the new row
            const keyInput = newRow.querySelector('input') as HTMLInputElement;
            if (keyInput) keyInput.focus();
        };

        tableContainer.appendChild(table);
        tableContainer.appendChild(addButton);
        this.container.appendChild(tableContainer);
    }

    private createTableRow(key: string, value: any): HTMLTableRowElement {
        const row = document.createElement('tr');

        // Key cell
        const keyCell = document.createElement('td');
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.value = key;
        keyInput.placeholder = 'Enter key';
        keyInput.className = 'blackboard-input';
        keyInput.addEventListener('change', () => this.updateBlackboardData());
        keyInput.addEventListener('input', () => this.updateBlackboardData());
        keyCell.appendChild(keyInput);

        // Value cell
        const valueCell = document.createElement('td');
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.value = value?.toString() || '';
        valueInput.placeholder = 'Enter value';
        valueInput.className = 'blackboard-input';
        valueInput.addEventListener('change', () => this.updateBlackboardData());
        valueInput.addEventListener('input', () => this.updateBlackboardData());
        valueCell.appendChild(valueInput);

        // Actions cell
        const actionsCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.className = 'blackboard-delete-button';
        deleteButton.textContent = '×';
        deleteButton.onclick = () => {
            row.remove();
            this.updateBlackboardData();
        };
        actionsCell.appendChild(deleteButton);

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        row.appendChild(actionsCell);

        return row;
    }

    private updateBlackboardData() {
        if (!this.currentNode) return;

        const table = this.container.querySelector('.blackboard-table');
        if (!table) return;

        const data: { [key: string]: any } = {};
        table.querySelectorAll('tbody tr').forEach(row => {
            const keyInput = row.querySelector('td:first-child input') as HTMLInputElement;
            const valueInput = row.querySelector('td:nth-child(2) input') as HTMLInputElement;
            if (keyInput && valueInput && keyInput.value) {
                data[keyInput.value] = valueInput.value;
            }
        });

        this.currentNode.blackboardData = data;
        (window as any).canvasManager.updateNodeBlackboardData(this.currentNode.id, data);
    }

    private createConfigSection(configName: string, configData: any): HTMLElement {
        const section = document.createElement('div');
        section.className = 'config-section';

        const title = document.createElement('div');
        title.className = 'config-title';
        title.textContent = configName;
        section.appendChild(title);

        const fields = document.createElement('div');
        fields.className = 'config-fields';

        // Get current values for this config
        const currentValues = this.currentNode && (window as any).canvasManager.getNodeConfigValues(this.currentNode.id);
        const configValues = currentValues?.[configName] || {};

        Object.entries(configData).forEach(([key, type]) => {
            const field = document.createElement('div');
            field.className = 'config-field';
            if (type === 'bool') {
                field.className += ' checkbox';
            }

            const label = document.createElement('label');
            label.textContent = key;
            field.appendChild(label);

            const input = document.createElement('input');
            input.type = this.getInputType(type as string);
            
            // Set current value if it exists
            const currentValue = configValues[key];
            if (input.type === 'checkbox') {
                input.checked = currentValue ?? false;
            } else {
                input.value = currentValue ?? '';
            }

            if (input.type === 'number') {
                input.step = type === 'float' ? '0.1' : '1';
            }
            input.placeholder = `Enter ${key}`;

            // Add event listener for value changes
            const updateValue = () => {
                if (!this.currentNode) return;

                let value: any;
                switch (input.type) {
                    case 'number':
                        value = type === 'float' ? parseFloat(input.value) : parseInt(input.value);
                        break;
                    case 'checkbox':
                        value = input.checked;
                        break;
                    default:
                        value = input.value;
                }

                (window as any).canvasManager.updateNodeConfigValue(
                    this.currentNode.id,
                    configName,
                    key,
                    value
                );
            };

            // Update on both change and input events
            input.addEventListener('change', updateValue);
            input.addEventListener('input', updateValue);

            field.appendChild(input);
            fields.appendChild(field);
        });

        section.appendChild(fields);
        return section;
    }

    private getInputType(type: string): string {
        switch (type) {
            case 'int':
            case 'float':
                return 'number';
            case 'bool':
                return 'checkbox';
            default:
                return 'text';
        }
    }

    clear() {
        // Only save changes if there was an actual change to the custom name
        if (this.currentNode && 
            this.customNameInput && 
            this.customNameInput.value !== this.originalCustomName) {
            // We can't await here since clear() isn't async, but that's okay
            // since this is just cleanup
            (window as any).canvasManager.updateNodeCustomName(this.currentNode.id, this.customNameInput.value);
        }
        
        // Only update custom type if it exists and has changed AND the node is a custom node
        if (this.currentNode && 
            this.customTypeInput && 
            this.customTypeInput.value !== this.currentNode.customType &&
            (this.currentNode.name === 'CustomAction' || this.currentNode.name === 'CustomCondition')) {
            (window as any).canvasManager.updateNodeCustomType(this.currentNode.id, this.customTypeInput.value);
        }

        this.currentNode = null;
        this.customNameInput = null;
        this.customTypeInput = null;
        this.originalCustomName = '';
        this.container.innerHTML = '';
    }

    resetCustomNameInput(value: string) {
        if (this.customNameInput) {
            this.customNameInput.value = value;
        }
    }
}

// Create and export the singleton instance
const rightColumn = new RightColumn();
(window as any).rightColumn = rightColumn; 