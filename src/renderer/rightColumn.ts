interface NodeConfig {
    id: string;
    name: string;
    type: string;
    has_children: boolean;
    customName?: string;
    configs?: string[];
}

class RightColumn {
    private container: HTMLElement;
    private currentNode: NodeConfig | null = null;
    private customNameInput: HTMLInputElement | null = null;
    private configsContainer: HTMLElement | null = null;
    private nodeConfigs: { [key: string]: any } = {};

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
        this.container.innerHTML = '';

        // Title (node type)
        const title = document.createElement('div');
        title.className = 'right-column-title';
        title.textContent = node.customName || node.name;
        this.container.appendChild(title);

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
        
        // Add event listener for input changes
        this.customNameInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            if (this.currentNode) {
                (window as any).canvasManager.updateNodeCustomName(this.currentNode.id, target.value);
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
        this.currentNode = null;
        this.container.innerHTML = '';
    }
}

// Create and export the singleton instance
const rightColumn = new RightColumn();
(window as any).rightColumn = rightColumn; 