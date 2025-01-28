interface CanvasNode {
    id: string;
    type: string;
    name: string;
    customName?: string;
    customType?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    has_children: boolean;
    configs?: string[];
    configValues?: { [key: string]: { [key: string]: any } };
    blackboardData?: { [key: string]: any };
    collapsed?: boolean;
}

interface Connection {
    fromNode: CanvasNode;
    toNode: CanvasNode;
}

class CanvasManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private nodes: CanvasNode[] = [];
    private connections: Connection[] = [];
    private isDragging = false;
    private isPanning = false;
    private isDrawingConnection = false;
    private connectionStartNode: CanvasNode | null = null;
    private currentMousePos = { x: 0, y: 0 };
    private draggedNode: CanvasNode | null = null;
    private selectedNodes: Set<CanvasNode> = new Set();
    private selectedConnections: Set<Connection> = new Set();
    private dragOffset = { x: 0, y: 0 };
    private dpr: number;
    private transform = {
        scale: 1,
        offsetX: 0,
        offsetY: 0
    };
    private skipDeleteConfirmation = false;
    private isRectangleSelecting = false;
    private selectionStart = { x: 0, y: 0 };
    private usedNames: Set<string> = new Set();
    private lastEvent: MouseEvent | null = null;
    
    // Fixed dimensions for nodes
    private static readonly NODE_HEIGHT = 60;
    private static readonly MIN_NODE_WIDTH = 150;
    private static readonly TEXT_PADDING = 20;
    private static readonly CONNECTION_POINT_RADIUS = 5;
    private static readonly CONNECTION_CLICK_THRESHOLD = 15;
    private static readonly MIN_SCALE = 0.1;
    private static readonly MAX_SCALE = 3;

    constructor() {
        this.canvas = document.getElementById('tree-canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.dpr = window.devicePixelRatio || 1;
        
        // Set up event listeners
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        
        // Add keyboard event listener for deleting connections
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Handle canvas resize
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('column-resize', this.handleResize.bind(this));
        this.handleResize();
    }

    private handleResize() {
        const container = this.canvas.parentElement;
        if (!container) return;

        // Update canvas size
        this.canvas.width = container.clientWidth * this.dpr;
        this.canvas.height = container.clientHeight * this.dpr;
        this.canvas.style.width = `${container.clientWidth}px`;
        this.canvas.style.height = `${container.clientHeight}px`;
        
        this.draw();
    }

    private calculateNodeWidth(text: string): number {
        this.ctx.font = '14px Arial';  // Match the font used in drawNode
        const textWidth = this.ctx.measureText(text).width;
        return Math.max(CanvasManager.MIN_NODE_WIDTH, textWidth + (CanvasManager.TEXT_PADDING * 2));
    }

    async addNode(type: string, name: string, has_children: boolean) {
        try {
            // Get the node type configuration
            const nodeTypes = await window.electronAPI.getNodeTypes();
            let configs: string[] = [];

            // Find the matching node type to get its configs
            if (type === 'root') {
                configs = nodeTypes.root.configs || [];
            } else {
                // Look in the appropriate category (actions, conditions, controls)
                const categoryKey = Object.keys(nodeTypes).find(key => {
                    if (Array.isArray(nodeTypes[key])) {
                        return nodeTypes[key].some((node: any) => node.name === name);
                    }
                    return false;
                });

                if (categoryKey) {
                    const nodeConfig = (nodeTypes[categoryKey] as any[]).find(node => node.name === name);
                    if (nodeConfig) {
                        configs = nodeConfig.configs || [];
                    }
                }
            }

            const nodeWidth = this.calculateNodeWidth(name);
            const node: CanvasNode = {
                id: Math.random().toString(36).substr(2, 9),
                type,
                name,
                x: (this.canvas.width / 2 / this.dpr) - nodeWidth / 2,
                y: (this.canvas.height / 2 / this.dpr) - CanvasManager.NODE_HEIGHT / 2,
                width: nodeWidth,
                height: CanvasManager.NODE_HEIGHT,
                has_children,
                configs,
                configValues: {}
            };

            // Initialize empty config values
            if (configs.length > 0) {
                const configsData = await window.electronAPI.getConfigs();
                configs.forEach(configName => {
                    if (configsData[configName]) {
                        node.configValues![configName] = {};
                        // Initialize each field with a default value based on its type
                        Object.entries(configsData[configName]).forEach(([key, type]) => {
                            node.configValues![configName][key] = this.getDefaultValueForType(type as string);
                        });
                    }
                });
            }

            this.nodes.push(node);
            this.draw();
        } catch (error) {
            console.error('Failed to add node:', error);
        }
    }

    private getDefaultValueForType(type: string): any {
        switch (type) {
            case 'int':
                return 0;
            case 'float':
                return 0.0;
            case 'bool':
                return false;
            case 'str':
                return '';
            default:
                return null;
        }
    }

    updateNodeConfigValue(nodeId: string, configName: string, key: string, value: any) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.configValues) {
            if (!node.configValues[configName]) {
                node.configValues[configName] = {};
            }

            // Get the old value before updating
            const oldValue = node.configValues[configName][key];
            
            // Update the config value
            node.configValues[configName][key] = value;

            // If this is a key field (ends with "_key") and we have a blackboard node
            if (key.endsWith('_key')) {
                // Find the blackboard node (should be a sibling of the root node)
                const blackboardNode = this.nodes.find(n => {
                    if (n.type === 'blackboard') {
                        // Check if this blackboard is connected to the same root as our node
                        const rootNode = this.findRootNode(node);
                        if (rootNode) {
                            const blackboardRoot = this.findRootNode(n);
                            return rootNode === blackboardRoot;
                        }
                    }
                    return false;
                });

                if (blackboardNode) {
                    // Initialize blackboardData if it doesn't exist
                    if (!blackboardNode.blackboardData) {
                        blackboardNode.blackboardData = {};
                    }

                    // If the old value existed and was different, remove it from blackboard
                    if (oldValue && oldValue !== value) {
                        delete blackboardNode.blackboardData[oldValue];
                    }

                    // If new value is not empty, add/update it in blackboard
                    if (value) {
                        blackboardNode.blackboardData[value] = '';
                    }

                    // Update the blackboard display
                    this.updateNodeBlackboardData(blackboardNode.id, blackboardNode.blackboardData);
                }
            }

            // Trigger a redraw to ensure any visual updates are applied
            this.draw();
        }
    }

    // Helper method to find the root node of a given node
    private findRootNode(node: CanvasNode): CanvasNode | null {
        // If this is the root node, return it
        if (node.type === 'root') {
            return node;
        }

        // Otherwise, find the node that connects to this one
        for (const connection of this.connections) {
            if (connection.toNode === node) {
                return this.findRootNode(connection.fromNode);
            }
        }

        return null;
    }

    getNodeConfigValues(nodeId: string): { [key: string]: { [key: string]: any } } | undefined {
        const node = this.nodes.find(n => n.id === nodeId);
        return node?.configValues;
    }

    private draw() {
        // Clear with correct scaling
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set up scaling for high DPI and apply transform
        this.ctx.setTransform(
            this.dpr * this.transform.scale, 
            0, 
            0, 
            this.dpr * this.transform.scale, 
            this.dpr * this.transform.offsetX, 
            this.dpr * this.transform.offsetY
        );
        
        // Draw all connections first (so they appear behind nodes)
        this.connections.forEach(conn => {
            const shouldDraw = !this.isNodeHidden(conn.fromNode) && !this.isNodeHidden(conn.toNode);
            if (shouldDraw) {
                this.drawConnection(conn);
            }
        });
        
        // Draw temporary connection line if we're drawing one
        if (this.isDrawingConnection && this.connectionStartNode) {
            this.drawConnectionLine(
                this.connectionStartNode.x + this.connectionStartNode.width / 2,
                this.connectionStartNode.y,
                this.currentMousePos.x,
                this.currentMousePos.y
            );
        }
        
        // Draw selection rectangle if active
        if (this.isRectangleSelecting) {
            const left = Math.min(this.selectionStart.x, this.currentMousePos.x);
            const right = Math.max(this.selectionStart.x, this.currentMousePos.x);
            const top = Math.min(this.selectionStart.y, this.currentMousePos.y);
            const bottom = Math.max(this.selectionStart.y, this.currentMousePos.y);

            this.ctx.strokeStyle = '#0066cc';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(left, top, right - left, bottom - top);
            this.ctx.setLineDash([]);
        }
        
        // Draw all visible nodes
        for (const node of this.nodes) {
            if (!this.isNodeHidden(node)) {
                this.drawNode(node);
            }
        }
    }

    private drawNode(node: CanvasNode) {
        const radius = node.type === 'blackboard' ? 0 : 10;
        const connectionPointRadius = 5;
        
        // Get theme colors
        const computedStyle = getComputedStyle(document.documentElement);
        const nodeBg = computedStyle.getPropertyValue('--node-bg');
        const nodeBorder = computedStyle.getPropertyValue('--node-border');
        const nodeText = computedStyle.getPropertyValue('--node-text');
        const nodeSelected = computedStyle.getPropertyValue('--node-selected');
        const nodeConnectionBg = computedStyle.getPropertyValue('--node-connection-bg');
        const nodeConnectionSelected = computedStyle.getPropertyValue('--node-connection-selected');
        
        // Draw main node rectangle with rounded corners (or square for blackboard)
        this.ctx.beginPath();
        if (node.type === 'blackboard') {
            this.ctx.rect(node.x, node.y, node.width, node.height);
        } else {
            this.ctx.moveTo(node.x + radius, node.y);
            this.ctx.lineTo(node.x + node.width - radius, node.y);
            this.ctx.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + radius);
            this.ctx.lineTo(node.x + node.width, node.y + node.height - radius);
            this.ctx.quadraticCurveTo(node.x + node.width, node.y + node.height, node.x + node.width - radius, node.y + node.height);
            this.ctx.lineTo(node.x + radius, node.y + node.height);
            this.ctx.quadraticCurveTo(node.x, node.y + node.height, node.x, node.y + node.height - radius);
            this.ctx.lineTo(node.x, node.y + radius);
            this.ctx.quadraticCurveTo(node.x, node.y, node.x + radius, node.y);
        }
        this.ctx.closePath();

        // Fill
        this.ctx.fillStyle = nodeBg;
        this.ctx.fill();
        
        // Stroke - selected color if selected, default color otherwise
        this.ctx.strokeStyle = this.selectedNodes.has(node) ? nodeSelected : nodeBorder;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw connection point circle at the top center
        this.ctx.beginPath();
        this.ctx.arc(node.x + node.width / 2, node.y, connectionPointRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.selectedNodes.has(node) ? nodeConnectionSelected : nodeConnectionBg;
        this.ctx.fill();
        this.ctx.strokeStyle = this.selectedNodes.has(node) ? nodeSelected : nodeBorder;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw bottom connection point circle if has_children is true
        if (node.has_children) {
            this.ctx.beginPath();
            this.ctx.arc(node.x + node.width / 2, node.y + node.height, connectionPointRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = this.selectedNodes.has(node) ? nodeConnectionSelected : nodeConnectionBg;
            this.ctx.fill();
            this.ctx.strokeStyle = this.selectedNodes.has(node) ? nodeSelected : nodeBorder;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw ellipsis if node is collapsed
            if (node.collapsed) {
                this.ctx.fillStyle = nodeText;
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('...', node.x + node.width / 2, node.y + node.height + 20);
            }
        }

        // Text
        this.ctx.fillStyle = nodeText;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        if (node.customName) {
            // Draw node type with larger font, shifted up
            this.ctx.font = '16px Arial';
            this.ctx.fillText(node.customType || node.name, node.x + node.width / 2, node.y + node.height / 2 - 10);
            
            // Draw custom name with smaller font, shifted down
            this.ctx.font = '12px Arial';
            this.ctx.fillText(node.customName, node.x + node.width / 2, node.y + node.height / 2 + 10);
        } else {
            // Draw node type centered in the node
            this.ctx.font = '16px Arial';
            this.ctx.fillText(node.customType || node.name, node.x + node.width / 2, node.y + node.height / 2);
        }
    }

    private getNodeAtPosition(x: number, y: number): CanvasNode | null {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            if (x >= node.x && x <= node.x + node.width &&
                y >= node.y && y <= node.y + node.height) {
                return node;
            }
        }
        return null;
    }

    private isOverConnectionPoint(node: CanvasNode, x: number, y: number, isTop: boolean): boolean {
        const centerX = node.x + node.width / 2;
        const centerY = isTop ? node.y : node.y + node.height;
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        return distance <= CanvasManager.CONNECTION_POINT_RADIUS;
    }

    private screenToCanvas(x: number, y: number): { x: number, y: number } {
        return {
            x: (x / this.transform.scale) - (this.transform.offsetX / this.transform.scale),
            y: (y / this.transform.scale) - (this.transform.offsetY / this.transform.scale)
        };
    }

    private handleWheel(e: WheelEvent) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(
            Math.max(
                this.transform.scale * zoomFactor,
                CanvasManager.MIN_SCALE
            ),
            CanvasManager.MAX_SCALE
        );

        // Calculate new offset to zoom towards mouse position
        const scale = newScale / this.transform.scale;
        this.transform.offsetX = mouseX - (mouseX - this.transform.offsetX) * scale;
        this.transform.offsetY = mouseY - (mouseY - this.transform.offsetY) * scale;
        this.transform.scale = newScale;

        this.draw();
    }

    private handleMouseDown(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x, y } = this.screenToCanvas(screenX, screenY);
        const isMultiSelect = e.ctrlKey || e.metaKey;

        // Start rectangle selection if shift is pressed
        if (e.shiftKey) {
            this.isRectangleSelecting = true;
            this.selectionStart = { x, y };
            if (!isMultiSelect) {
                this.selectedNodes.clear();
                this.selectedConnections.clear();
            }
            return;
        }

        // Check if we're clicking on any node's connection points
        for (const node of this.nodes) {
            // Check top connection point
            if (this.isOverConnectionPoint(node, x, y, true)) {
                this.isDrawingConnection = true;
                this.connectionStartNode = node;
                this.currentMousePos = { x, y };
                if (!isMultiSelect) {
                    this.selectedNodes.clear();
                    this.selectedConnections.clear();
                }
                return;
            }
            
            // Check bottom connection point if node has children
            if (node.has_children && this.isOverConnectionPoint(node, x, y, false)) {
                this.isDrawingConnection = true;
                this.connectionStartNode = node;
                this.currentMousePos = { x, y };
                if (!isMultiSelect) {
                    this.selectedNodes.clear();
                    this.selectedConnections.clear();
                }
                return;
            }
        }

        // Check if clicking on a connection
        const connection = this.getConnectionAtPosition(x, y);
        if (connection) {
            if (isMultiSelect) {
                // Toggle connection selection
                if (this.selectedConnections.has(connection)) {
                    this.selectedConnections.delete(connection);
                } else {
                    this.selectedConnections.add(connection);
                }
            } else {
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                this.selectedConnections.add(connection);
            }
            this.draw();
            return;
        }

        // If not starting a connection or selecting an edge, handle regular node dragging
        const node = this.getNodeAtPosition(x, y);
        
        if (node) {
            this.isDragging = true;
            this.draggedNode = node;
            this.dragOffset.x = x - node.x;
            this.dragOffset.y = y - node.y;

            if (isMultiSelect) {
                // Toggle node selection
                if (this.selectedNodes.has(node)) {
                    this.selectedNodes.delete(node);
                } else {
                    this.selectedNodes.add(node);
                }
            } else if (!this.selectedNodes.has(node)) {
                // If clicking an unselected node without modifier key, clear selection and select only this node
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                this.selectedNodes.add(node);
            }
            
            // Display node information in right column
            (window as any).rightColumn.displayNode(node);
        } else {
            // Start panning if clicking on empty space
            this.isPanning = true;
            this.dragOffset.x = screenX - this.transform.offsetX;
            this.dragOffset.y = screenY - this.transform.offsetY;
            if (!isMultiSelect) {
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                (window as any).rightColumn.clear();
            }
        }
        
        this.draw();
    }

    private handleMouseMove(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x, y } = this.screenToCanvas(screenX, screenY);
        
        this.lastEvent = e;

        if (this.isRectangleSelecting) {
            this.currentMousePos = { x, y };
            this.updateRectangleSelection();
            this.draw();
            return;
        }

        if (this.isPanning) {
            this.transform.offsetX = screenX - this.dragOffset.x;
            this.transform.offsetY = screenY - this.dragOffset.y;
            this.draw();
            return;
        }

        if (this.isDrawingConnection) {
            this.currentMousePos = { x, y };
            this.draw();
            return;
        }

        if (this.isDragging && this.draggedNode) {
            // Calculate the movement delta
            const dx = x - this.dragOffset.x - this.draggedNode.x;
            const dy = y - this.dragOffset.y - this.draggedNode.y;

            // If the dragged node is selected, move all selected nodes and their descendants
            if (this.selectedNodes.has(this.draggedNode)) {
                const nodesToMove = new Set<CanvasNode>();
                
                // Add all selected nodes and their descendants
                this.selectedNodes.forEach(node => {
                    nodesToMove.add(node);
                    if (node.has_children) {
                        this.getDescendantNodes(node).forEach(descendant => nodesToMove.add(descendant));
                    }
                });

                // Move all nodes in the set
                nodesToMove.forEach(node => {
                    node.x += dx;
                    node.y += dy;
                });
            } else {
                // If dragging an unselected node, move it and its descendants
                this.draggedNode.x = x - this.dragOffset.x;
                this.draggedNode.y = y - this.dragOffset.y;
                
                if (this.draggedNode.has_children) {
                    const descendants = this.getDescendantNodes(this.draggedNode);
                    descendants.forEach(node => {
                        node.x += dx;
                        node.y += dy;
                    });
                }
            }
            this.draw();
        }
    }

    private handleMouseUp(e: MouseEvent) {
        if (this.isRectangleSelecting) {
            this.isRectangleSelecting = false;
            this.draw();
            return;
        }

        if (this.isDrawingConnection && this.connectionStartNode) {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const { x, y } = this.screenToCanvas(screenX, screenY);

            // Check if we're over any node's top connection point
            for (const node of this.nodes) {
                if (node !== this.connectionStartNode && 
                    this.isOverConnectionPoint(node, x, y, true)) {
                    // If connecting to a root node that has a child, connect to its child instead
                    let targetNode = node;
                    if (node.type === 'root') {
                        const children = this.getNodeChildren(node);
                        const regularChild = children.find(child => child.type !== 'blackboard');
                        if (regularChild) {
                            // Remove the root node and its connections
                            this.nodes = this.nodes.filter(n => n !== node);
                            this.connections = this.connections.filter(conn => 
                                conn.fromNode !== node && conn.toNode !== node
                            );
                            targetNode = regularChild;
                        }
                    }

                    // Check if the target node already has a parent
                    if (this.hasParent(targetNode)) {
                        this.showErrorMessage('Nodes can only have one parent');
                        break;
                    }

                    // Check if the source node is a decorator and already has a child
                    if (this.connectionStartNode.type === 'decorator' && this.getNodeChildCount(this.connectionStartNode) > 0) {
                        this.showErrorMessage('Decorator nodes can only have one child');
                        break;
                    }

                    // Add validation for blackboard nodes
                    if (node.type === 'blackboard' && this.connectionStartNode.type !== 'root') {
                        this.showErrorMessage('Blackboard nodes can only connect to root nodes');
                        break;
                    }

                    // Add validation for root node connections
                    if (this.connectionStartNode.type === 'root') {
                        const existingChildren = this.getNodeChildren(this.connectionStartNode);
                        const hasBlackboard = existingChildren.some(child => child.type === 'blackboard');
                        const hasRegularNode = existingChildren.some(child => child.type !== 'blackboard');

                        if (node.type === 'blackboard' && hasBlackboard) {
                            this.showErrorMessage('Root node can only have one blackboard node');
                            break;
                        }
                        if (node.type !== 'blackboard' && hasRegularNode) {
                            this.showErrorMessage('Root node can only have one regular node');
                            break;
                        }
                    }

                    // Create the connection
                    this.connections.push({
                        fromNode: this.connectionStartNode,
                        toNode: targetNode
                    });
                    break;
                }
            }
        }

        this.isDragging = false;
        this.isPanning = false;
        this.isDrawingConnection = false;
        this.connectionStartNode = null;
        this.draggedNode = null;
        this.draw();
    }

    private drawConnections() {
        for (const connection of this.connections) {
            this.drawConnection(connection);
        }
    }

    private drawConnection(connection: Connection) {
        const fromX = connection.fromNode.x + connection.fromNode.width / 2;
        const fromY = connection.fromNode.y + connection.fromNode.height;
        const toX = connection.toNode.x + connection.toNode.width / 2;
        const toY = connection.toNode.y;
        
        // Get theme colors
        const computedStyle = getComputedStyle(document.documentElement);
        const connectionLine = computedStyle.getPropertyValue('--connection-line');
        const connectionSelected = computedStyle.getPropertyValue('--connection-selected');
        
        // Set line style based on selection
        this.ctx.strokeStyle = this.selectedConnections.has(connection) ? connectionSelected : connectionLine;
        this.ctx.lineWidth = this.selectedConnections.has(connection) ? 3 : 2;
        
        this.drawConnectionLine(fromX, fromY, toX, toY);
    }

    private drawConnectionLine(fromX: number, fromY: number, toX: number, toY: number) {
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);

        // Calculate control points for the quadratic Bézier curve
        // We'll extend the curve vertically from both points for a natural flow
        const distance = Math.abs(toY - fromY);
        const controlPoint1X = fromX;
        const controlPoint1Y = fromY + distance * 0.5;
        const controlPoint2X = toX;
        const controlPoint2Y = toY - distance * 0.5;

        // Draw a cubic Bézier curve
        this.ctx.bezierCurveTo(
            controlPoint1X, controlPoint1Y,  // First control point
            controlPoint2X, controlPoint2Y,  // Second control point
            toX, toY                        // End point
        );

        this.ctx.stroke();
    }

    private isPointNearCurve(x: number, y: number, fromX: number, fromY: number, toX: number, toY: number): boolean {
        const distance = Math.abs(toY - fromY);
        const controlPoint1Y = fromY + distance * 0.5;
        const controlPoint2Y = toY - distance * 0.5;
        
        // Check multiple points along the curve
        const steps = 20;
        const threshold = CanvasManager.CONNECTION_CLICK_THRESHOLD; // Use the new constant
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Cubic Bezier curve formula
            const curveX = Math.pow(1 - t, 3) * fromX +
                          3 * Math.pow(1 - t, 2) * t * fromX +
                          3 * (1 - t) * Math.pow(t, 2) * toX +
                          Math.pow(t, 3) * toX;
            const curveY = Math.pow(1 - t, 3) * fromY +
                          3 * Math.pow(1 - t, 2) * t * controlPoint1Y +
                          3 * (1 - t) * Math.pow(t, 2) * controlPoint2Y +
                          Math.pow(t, 3) * toY;
            
            const dx = x - curveX;
            const dy = y - curveY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < threshold) {
                return true;
            }
        }
        return false;
    }

    private getConnectionAtPosition(x: number, y: number): Connection | null {
        for (const connection of this.connections) {
            const fromX = connection.fromNode.x + connection.fromNode.width / 2;
            const fromY = connection.fromNode.y + connection.fromNode.height;
            const toX = connection.toNode.x + connection.toNode.width / 2;
            const toY = connection.toNode.y;
            
            if (this.isPointNearCurve(x, y, fromX, fromY, toX, toY)) {
                return connection;
            }
        }
        return null;
    }

    private handleKeyDown(e: KeyboardEvent) {
        // Don't handle keyboard shortcuts if user is typing in an input field
        const activeElement = document.activeElement;
        const isTyping = activeElement instanceof HTMLInputElement || 
                        activeElement instanceof HTMLTextAreaElement;

        if (e.key === 'x') {
            const numSelectedNodes = this.selectedNodes.size;
            const numSelectedConnections = this.selectedConnections.size;
            const totalSelected = numSelectedNodes + numSelectedConnections;

            if (totalSelected > 0) {
                if (this.skipDeleteConfirmation) {
                    this.deleteSelectedNodes();
                    this.deleteSelectedConnections();
                } else {
                    this.showDeleteConfirmationModal(numSelectedNodes, numSelectedConnections);
                }
            }
        } else if (e.key === 'd' && !isTyping) {
            // Handle duplication of selected nodes and connections
            if (this.selectedNodes.size > 0) {
                // Create a map to store original node to duplicate node mapping
                const nodeMap = new Map<CanvasNode, CanvasNode>();
                
                // First pass: create duplicates of all selected nodes
                this.selectedNodes.forEach(node => {
                    const duplicate: CanvasNode = {
                        ...node,
                        id: Math.random().toString(36).substr(2, 9),
                        x: node.x + 50, // Offset to the right
                        y: node.y,
                        configValues: JSON.parse(JSON.stringify(node.configValues || {}))
                    };

                    // Handle custom names
                    if (duplicate.customName) {
                        let newName = `${duplicate.customName}_copy`;
                        let counter = 1;
                        while (this.usedNames.has(newName)) {
                            newName = `${duplicate.customName}_copy_${counter}`;
                            counter++;
                        }
                        this.usedNames.add(newName);
                        duplicate.customName = newName;
                    }

                    nodeMap.set(node, duplicate);
                    this.nodes.push(duplicate);
                });

                // Second pass: create connections between duplicated nodes
                this.selectedConnections.forEach(conn => {
                    // Only duplicate connection if both nodes were selected
                    const fromDuplicate = nodeMap.get(conn.fromNode);
                    const toDuplicate = nodeMap.get(conn.toNode);
                    if (fromDuplicate && toDuplicate) {
                        this.connections.push({
                            fromNode: fromDuplicate,
                            toNode: toDuplicate
                        });
                    }
                });

                // Clear current selection and select the duplicates
                this.selectedNodes.clear();
                this.selectedConnections.clear();
                nodeMap.forEach((duplicate) => {
                    this.selectedNodes.add(duplicate);
                });

                this.draw();
            }
        } else if (e.key === 'h' && !isTyping) {
            // Check if help modal already exists
            const existingModal = document.querySelector('.modal-overlay');
            if (!existingModal) {
                this.showHelpModal();
            }
        }
    }

    private showDeleteConfirmationModal(numNodes: number = 0, numConnections: number = 0) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.backgroundColor = 'var(--bg-color)';
        modal.style.color = 'var(--text-color)';

        // Create modal title
        const title = document.createElement('div');
        title.className = 'modal-title';
        title.textContent = 'Delete Selected Objects';

        // Create modal content with dynamic text
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        let message = 'Are you sure you want to delete ';
        const parts = [];
        if (numNodes > 0) {
            parts.push(`${numNodes} node${numNodes > 1 ? 's' : ''}`);
        }
        if (numConnections > 0) {
            parts.push(`${numConnections} connection${numConnections > 1 ? 's' : ''}`);
        }
        message += parts.join(' and ') + '?';
        content.textContent = message;

        // Create checkbox for "don't ask again"
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'modal-checkbox';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'dont-ask-again';
        
        const label = document.createElement('label');
        label.htmlFor = 'dont-ask-again';
        label.textContent = "Don't ask again";
        
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);

        // Create action buttons
        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const cancelButton = document.createElement('button');
        cancelButton.className = 'modal-button modal-button-secondary';
        cancelButton.textContent = 'No';
        cancelButton.onclick = () => {
            document.body.removeChild(overlay);
        };

        const deleteButton = document.createElement('button');
        deleteButton.className = 'modal-button modal-button-primary';
        deleteButton.textContent = 'Yes';
        deleteButton.onclick = () => {
            if (checkbox.checked) {
                this.skipDeleteConfirmation = true;
            }
            this.deleteSelectedNodes();
            this.deleteSelectedConnections();
            document.body.removeChild(overlay);
        };

        // Assemble modal
        actions.appendChild(cancelButton);
        actions.appendChild(deleteButton);

        modal.appendChild(title);
        modal.appendChild(content);
        modal.appendChild(checkboxContainer);
        modal.appendChild(actions);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    private deleteSelectedNodes() {
        if (this.selectedNodes.size > 0) {
            // Remove custom names from used names
            this.selectedNodes.forEach(node => {
                if (node.customName) {
                    this.usedNames.delete(node.customName);
                }
            });

            // Remove all connections associated with selected nodes
            this.connections = this.connections.filter(conn => 
                !this.selectedNodes.has(conn.fromNode) && !this.selectedNodes.has(conn.toNode)
            );

            // Remove the nodes
            this.nodes = this.nodes.filter(node => !this.selectedNodes.has(node));
            this.selectedNodes.clear();
            (window as any).rightColumn.clear();
            this.draw();
        }
    }

    private deleteSelectedConnections() {
        if (this.selectedConnections.size > 0) {
            this.connections = this.connections.filter(conn => !this.selectedConnections.has(conn));
            this.selectedConnections.clear();
            this.draw();
        }
    }

    // Update method to update node custom name with validation
    updateNodeCustomName(nodeId: string, customName: string) {
        // Don't validate empty names - they're allowed
        if (customName && this.usedNames.has(customName)) {
            // Show error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = 'This name is already in use';
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

            // Reset the input in the right column
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                (window as any).rightColumn.resetCustomNameInput(node.customName || '');
            }
            return;
        }

        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            // Remove old name from used names if it exists
            if (node.customName) {
                this.usedNames.delete(node.customName);
            }
            // Add new name to used names if it's not empty
            if (customName) {
                this.usedNames.add(customName);
            }
            node.customName = customName;
            this.draw();
        }
    }

    // Add method to update node custom type
    updateNodeCustomType(nodeId: string, customType: string) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node.customType = customType;
            this.draw();
        }
    }

    // Serialize the tree structure to JSON
    serializeTree() {
        // Create a simplified version of nodes with only logical information
        const logicalNodes = this.nodes.map(node => ({
            id: node.id,
            type: node.type,
            name: node.name,
            customName: node.customName,
            customType: node.customType,
            has_children: node.has_children,
            configs: node.configs,
            configValues: node.configValues,
            blackboardData: node.blackboardData
        }));

        // Create a simplified version of connections using node IDs
        const logicalConnections = this.connections.map(conn => ({
            fromNodeId: conn.fromNode.id,
            toNodeId: conn.toNode.id
        }));

        // Create display information for nodes
        const displayInfo = {
            nodes: this.nodes.map(node => ({
                id: node.id,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height
            })),
            transform: this.transform
        };

        return {
            // Logical structure of the tree
            logical: {
                nodes: logicalNodes,
                connections: logicalConnections
            },
            // Visual/display information
            display: displayInfo
        };
    }

    // Save the current tree
    async save() {
        try {
            const treeData = this.serializeTree();
            return await window.electronAPI.saveTree(treeData);
        } catch (error) {
            console.error('Failed to save tree:', error);
            throw error;
        }
    }

    // Load a tree from saved data
    async loadTree(treeData: any) {
        try {
            // Clear existing state
            this.nodes = [];
            this.connections = [];
            this.selectedNodes.clear();
            this.selectedConnections.clear();
            this.usedNames.clear();
            (window as any).rightColumn.clear();

            // Load nodes first
            const nodeMap = new Map<string, CanvasNode>();
            
            // Create nodes with both logical and display information
            for (const logicalNode of treeData.logical.nodes) {
                const displayNode = treeData.display.nodes.find((n: any) => n.id === logicalNode.id);
                if (!displayNode) continue;

                const node: CanvasNode = {
                    ...logicalNode,
                    x: displayNode.x,
                    y: displayNode.y,
                    width: displayNode.width,
                    height: displayNode.height,
                    blackboardData: logicalNode.blackboardData || {}
                };
                
                // Add custom name to used names if it exists
                if (node.customName) {
                    this.usedNames.add(node.customName);
                }
                
                this.nodes.push(node);
                nodeMap.set(node.id, node);
            }

            // Track decorator child counts and node parents to validate connections
            const decoratorChildCounts = new Map<string, number>();
            const nodeParents = new Map<string, boolean>();

            // Restore connections using the node map
            for (const conn of treeData.logical.connections) {
                const fromNode = nodeMap.get(conn.fromNodeId);
                const toNode = nodeMap.get(conn.toNodeId);
                if (fromNode && toNode) {
                    // Skip if target node already has a parent
                    if (nodeParents.has(toNode.id)) {
                        console.warn(`Skipping invalid connection: node ${toNode.id} already has a parent`);
                        continue;
                    }

                    // Skip invalid decorator connections
                    if (fromNode.type === 'decorator') {
                        const childCount = decoratorChildCounts.get(fromNode.id) || 0;
                        if (childCount > 0) {
                            console.warn(`Skipping invalid connection: decorator node ${fromNode.id} already has a child`);
                            continue;
                        }
                        decoratorChildCounts.set(fromNode.id, childCount + 1);
                    }

                    // Mark node as having a parent
                    nodeParents.set(toNode.id, true);

                    this.connections.push({
                        fromNode,
                        toNode
                    });
                }
            }

            // Restore transform
            if (treeData.display.transform) {
                this.transform = treeData.display.transform;
            }

            this.draw();
        } catch (error) {
            console.error('Failed to load tree:', error);
            throw error;
        }
    }

    // Open a tree from a file
    async open() {
        try {
            const treeData = await window.electronAPI.openTree();
            if (treeData) {
                await this.loadTree(treeData);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to open tree:', error);
            throw error;
        }
    }

    // Check if the canvas has any content
    hasContent(): boolean {
        return this.nodes.length > 0;
    }

    // Clear the canvas
    clear() {
        this.nodes = [];
        this.connections = [];
        this.selectedNodes.clear();
        this.selectedConnections.clear();
        this.usedNames.clear();
        this.transform = {
            scale: 1,
            offsetX: 0,
            offsetY: 0
        };
        (window as any).rightColumn.clear();
        this.draw();
    }

    // New method to handle the new action
    async handleNew() {
        if (this.hasContent()) {
            const shouldSave = await window.electronAPI.showSaveConfirmation();
            if (shouldSave === 'save') {
                await this.save();
            } else if (shouldSave === 'cancel') {
                return;
            }
        }
        this.clear();
    }

    // Find a suitable position for a new tree to avoid overlaps
    private findSuitablePosition(nodes: CanvasNode[]): { offsetX: number, offsetY: number } {
        if (this.nodes.length === 0) return { offsetX: 0, offsetY: 0 };

        // Calculate bounding box of existing nodes
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const node of this.nodes) {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x + node.width);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y + node.height);
        }

        // Calculate bounding box of new nodes
        let newMinX = Infinity, newMaxX = -Infinity, newMinY = Infinity, newMaxY = -Infinity;
        for (const node of nodes) {
            newMinX = Math.min(newMinX, node.x);
            newMaxX = Math.max(newMaxX, node.x + node.width);
            newMinY = Math.min(newMinY, node.y);
            newMaxY = Math.max(newMaxY, node.y + node.height);
        }

        // Calculate dimensions of both bounding boxes
        const existingWidth = maxX - minX;
        const existingHeight = maxY - minY;
        const newWidth = newMaxX - newMinX;
        const newHeight = newMaxY - newMinY;

        // Position the new tree to the right of existing nodes with padding
        const padding = 50; // Reduced padding since we're ensuring no overlap
        
        // Calculate offset to place new tree's left edge at existing tree's right edge + padding
        const offsetX = maxX - newMinX + padding;
        
        // Center the new tree vertically relative to existing tree
        // but ensure it doesn't overlap by checking height extents
        let offsetY = (maxY + minY) / 2 - (newMaxY + newMinY) / 2;
        
        // Check if vertical centering would cause overlap
        const newTopEdge = newMinY + offsetY;
        const newBottomEdge = newMaxY + offsetY;
        
        // If there would be vertical overlap, place the new tree below with padding
        if (newTopEdge <= maxY && newBottomEdge >= minY) {
            offsetY = maxY - newMinY + padding;
        }

        return { offsetX, offsetY };
    }

    // Add a tree to the existing canvas
    async addTree(treeData: any) {
        try {
            // Create temporary nodes to calculate positioning
            const tempNodes: CanvasNode[] = [];
            const nodeMap = new Map<string, CanvasNode>();
            
            // Create nodes with both logical and display information
            for (const logicalNode of treeData.logical.nodes) {
                const displayNode = treeData.display.nodes.find((n: any) => n.id === logicalNode.id);
                if (!displayNode) continue;

                const node: CanvasNode = {
                    ...logicalNode,
                    // Generate new ID to avoid conflicts
                    id: Math.random().toString(36).substr(2, 9),
                    x: displayNode.x,
                    y: displayNode.y,
                    width: displayNode.width,
                    height: displayNode.height
                };
                
                tempNodes.push(node);
                nodeMap.set(logicalNode.id, node); // Map old ID to new node
            }

            // Find suitable position for the new tree
            const { offsetX, offsetY } = this.findSuitablePosition(tempNodes);

            // Apply offset to all nodes
            tempNodes.forEach(node => {
                node.x += offsetX;
                node.y += offsetY;
            });

            // Add nodes to canvas
            this.nodes.push(...tempNodes);

            // Add connections using the new nodes
            for (const conn of treeData.logical.connections) {
                const fromNode = nodeMap.get(conn.fromNodeId);
                const toNode = nodeMap.get(conn.toNodeId);
                if (fromNode && toNode) {
                    this.connections.push({
                        fromNode,
                        toNode
                    });
                }
            }

            this.draw();
            return true;
        } catch (error) {
            console.error('Failed to add tree:', error);
            throw error;
        }
    }

    // Add a tree from a file
    async addTreeFromFile() {
        try {
            const treeData = await window.electronAPI.openTree();
            if (treeData) {
                await this.addTree(treeData);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to add tree:', error);
            throw error;
        }
    }

    private updateRectangleSelection() {
        const left = Math.min(this.selectionStart.x, this.currentMousePos.x);
        const right = Math.max(this.selectionStart.x, this.currentMousePos.x);
        const top = Math.min(this.selectionStart.y, this.currentMousePos.y);
        const bottom = Math.max(this.selectionStart.y, this.currentMousePos.y);

        // Clear existing selection if not in multi-select mode
        if (!(this.lastEvent && (this.lastEvent.ctrlKey || this.lastEvent.metaKey))) {
            this.selectedNodes.clear();
            this.selectedConnections.clear();
        }

        // Check each node for intersection with selection rectangle
        for (const node of this.nodes) {
            const nodeRight = node.x + node.width;
            const nodeBottom = node.y + node.height;

            if (node.x <= right && nodeRight >= left && node.y <= bottom && nodeBottom >= top) {
                this.selectedNodes.add(node);
            }
        }

        // Check each connection for intersection with selection rectangle
        for (const connection of this.connections) {
            const fromX = connection.fromNode.x + connection.fromNode.width / 2;
            const fromY = connection.fromNode.y + connection.fromNode.height;
            const toX = connection.toNode.x + connection.toNode.width / 2;
            const toY = connection.toNode.y;

            // Simple line-box intersection check
            if (this.lineIntersectsBox(fromX, fromY, toX, toY, left, top, right, bottom)) {
                this.selectedConnections.add(connection);
            }
        }
    }

    private lineIntersectsBox(x1: number, y1: number, x2: number, y2: number, left: number, top: number, right: number, bottom: number): boolean {
        // Cohen-Sutherland algorithm for line clipping
        const INSIDE = 0;
        const LEFT = 1;
        const RIGHT = 2;
        const BOTTOM = 4;
        const TOP = 8;

        function computeCode(x: number, y: number): number {
            let code = INSIDE;
            if (x < left) code |= LEFT;
            else if (x > right) code |= RIGHT;
            if (y < top) code |= TOP;
            else if (y > bottom) code |= BOTTOM;
            return code;
        }

        let code1 = computeCode(x1, y1);
        let code2 = computeCode(x2, y2);

        while (true) {
            if (!(code1 | code2)) return true;  // Both points inside
            if (code1 & code2) return false;    // Both points on same side

            return true; // Line intersects the box
        }
    }

    private showHelpModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.backgroundColor = 'var(--bg-color)';
        modal.style.color = 'var(--text-color)';

        // Create title
        const title = document.createElement('h2');
        title.className = 'modal-title';
        title.textContent = 'Help';

        // Create content
        const content = document.createElement('div');
        content.className = 'modal-content';

        // Create keyboard shortcuts list
        const shortcuts = document.createElement('ul');
        shortcuts.style.listStyle = 'none';
        shortcuts.style.padding = '0';
        shortcuts.style.margin = '0';

        const shortcutItems = [
            { key: 'h', description: 'Show this help menu' },
            { key: this.isMac() ? 'Command + Click' : 'Control + Click', description: 'Select a node or connection' },
            { key: 'Shift + Drag', description: 'Group select nodes and connections' },
            { key: 'x', description: 'Delete selected nodes and connections' },
            { key: 'd', description: 'Duplicate selected nodes and connections' },
            { key: 'Escape', description: 'Close this help menu' }
        ];

        shortcutItems.forEach(item => {
            const li = document.createElement('li');
            li.style.marginBottom = '10px';
            
            const keySpan = document.createElement('span');
            keySpan.style.backgroundColor = 'var(--modal-key-bg)';
            keySpan.style.color = 'var(--modal-key-text)';
            keySpan.style.padding = '2px 6px';
            keySpan.style.borderRadius = '4px';
            keySpan.style.marginRight = '8px';
            keySpan.textContent = item.key;

            li.appendChild(keySpan);
            li.appendChild(document.createTextNode(item.description));
            shortcuts.appendChild(li);
        });

        content.appendChild(shortcuts);

        // Assemble modal
        modal.appendChild(title);
        modal.appendChild(content);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on escape key
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        // Close on click outside modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleKeyDown);
            }
        });
    }

    private isMac() {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    }

    private handleDoubleClick(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x, y } = this.screenToCanvas(screenX, screenY);

        const node = this.getNodeAtPosition(x, y);
        if (node && node.has_children) {
            node.collapsed = !node.collapsed;
            this.draw();
        }
    }

    private isNodeHidden(node: CanvasNode): boolean {
        // Check if any parent node is collapsed
        const parentConnection = this.connections.find(conn => conn.toNode === node);
        if (parentConnection) {
            const parent = parentConnection.fromNode;
            return parent.collapsed || this.isNodeHidden(parent);
        }
        return false;
    }

    private getDescendantNodes(node: CanvasNode): Set<CanvasNode> {
        const descendants = new Set<CanvasNode>();
        const stack = [node];

        while (stack.length > 0) {
            const current = stack.pop()!;
            // Find all child nodes through connections
            this.connections
                .filter(conn => conn.fromNode === current)
                .forEach(conn => {
                    descendants.add(conn.toNode);
                    stack.push(conn.toNode);
                });
        }

        return descendants;
    }

    private getNodeChildCount(node: CanvasNode): number {
        return this.connections.filter(conn => conn.fromNode === node).length;
    }

    private hasParent(node: CanvasNode): boolean {
        return this.connections.some(conn => conn.toNode === node);
    }

    // Add helper method to show error messages
    private showErrorMessage(message: string) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = message;
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
    }

    // Add helper method to get node's children
    private getNodeChildren(node: CanvasNode): CanvasNode[] {
        return this.connections
            .filter(conn => conn.fromNode === node)
            .map(conn => conn.toNode);
    }

    updateNodeBlackboardData(nodeId: string, data: { [key: string]: any }) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node.blackboardData = data;
            this.draw();
        }
    }
}

// Create and export the singleton instance
const canvasManager = new CanvasManager();
(window as any).canvasManager = canvasManager; 