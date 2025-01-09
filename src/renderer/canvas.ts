interface CanvasNode {
    id: string;
    type: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    has_children: boolean;
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
    private isDrawingConnection = false;
    private connectionStartNode: CanvasNode | null = null;
    private currentMousePos = { x: 0, y: 0 };
    private draggedNode: CanvasNode | null = null;
    private selectedNode: CanvasNode | null = null;
    private selectedConnection: Connection | null = null;
    private dragOffset = { x: 0, y: 0 };
    private dpr: number;
    
    // Fixed dimensions for nodes
    private static readonly NODE_HEIGHT = 50;
    private static readonly MIN_NODE_WIDTH = 150;
    private static readonly TEXT_PADDING = 20; // Padding on each side of the text
    private static readonly CONNECTION_POINT_RADIUS = 5;

    constructor() {
        this.canvas = document.getElementById('tree-canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.dpr = window.devicePixelRatio || 1;
        
        // Set up event listeners
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
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

    addNode(type: string, name: string, has_children: boolean) {
        const nodeWidth = this.calculateNodeWidth(name);
        const node: CanvasNode = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            name,
            x: (this.canvas.width / 2 / this.dpr) - nodeWidth / 2,
            y: (this.canvas.height / 2 / this.dpr) - CanvasManager.NODE_HEIGHT / 2,
            width: nodeWidth,
            height: CanvasManager.NODE_HEIGHT,
            has_children
        };
        this.nodes.push(node);
        this.draw();
    }

    private draw() {
        // Clear with correct scaling
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set up scaling for high DPI
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        
        // Draw all connections first (so they appear behind nodes)
        this.drawConnections();
        
        // Draw temporary connection line if we're drawing one
        if (this.isDrawingConnection && this.connectionStartNode) {
            this.drawConnectionLine(
                this.connectionStartNode.x + this.connectionStartNode.width / 2,
                this.connectionStartNode.y,
                this.currentMousePos.x,
                this.currentMousePos.y
            );
        }
        
        // Draw all nodes
        for (const node of this.nodes) {
            this.drawNode(node);
        }
    }

    private drawNode(node: CanvasNode) {
        const radius = 10;
        const connectionPointRadius = 5; // Radius of the connection point circle
        
        // Draw main node rectangle with rounded corners
        this.ctx.beginPath();
        this.ctx.moveTo(node.x + radius, node.y);
        this.ctx.lineTo(node.x + node.width - radius, node.y);
        this.ctx.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + radius);
        this.ctx.lineTo(node.x + node.width, node.y + node.height - radius);
        this.ctx.quadraticCurveTo(node.x + node.width, node.y + node.height, node.x + node.width - radius, node.y + node.height);
        this.ctx.lineTo(node.x + radius, node.y + node.height);
        this.ctx.quadraticCurveTo(node.x, node.y + node.height, node.x, node.y + node.height - radius);
        this.ctx.lineTo(node.x, node.y + radius);
        this.ctx.quadraticCurveTo(node.x, node.y, node.x + radius, node.y);
        this.ctx.closePath();

        // Fill
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fill();
        
        // Stroke - red if selected, default color otherwise
        this.ctx.strokeStyle = node === this.selectedNode ? '#ff0000' : '#666';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw connection point circle at the top center
        this.ctx.beginPath();
        this.ctx.arc(node.x + node.width / 2, node.y, connectionPointRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = node === this.selectedNode ? '#ffcccc' : '#e0e0e0';
        this.ctx.fill();
        this.ctx.strokeStyle = node === this.selectedNode ? '#ff0000' : '#666';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw bottom connection point circle if has_children is true
        if (node.has_children) {
            this.ctx.beginPath();
            this.ctx.arc(node.x + node.width / 2, node.y + node.height, connectionPointRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = node === this.selectedNode ? '#ffcccc' : '#e0e0e0';
            this.ctx.fill();
            this.ctx.strokeStyle = node === this.selectedNode ? '#ff0000' : '#666';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Text
        this.ctx.fillStyle = '#000';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.name, node.x + node.width / 2, node.y + node.height / 2);
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

    private handleMouseDown(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);

        // Check if we're clicking on any node's connection points
        for (const node of this.nodes) {
            // Check top connection point
            if (this.isOverConnectionPoint(node, x, y, true)) {
                this.isDrawingConnection = true;
                this.connectionStartNode = node;
                this.currentMousePos = { x, y };
                this.selectedNode = null;
                this.selectedConnection = null;
                return;
            }
            
            // Check bottom connection point if node has children
            if (node.has_children && this.isOverConnectionPoint(node, x, y, false)) {
                this.isDrawingConnection = true;
                this.connectionStartNode = node;
                this.currentMousePos = { x, y };
                this.selectedNode = null;
                this.selectedConnection = null;
                return;
            }
        }

        // Check if clicking on a connection
        const connection = this.getConnectionAtPosition(x, y);
        if (connection) {
            this.selectedConnection = connection;
            this.selectedNode = null;
            this.draw();
            return;
        }

        // If not starting a connection or selecting an edge, handle regular node dragging
        const node = this.getNodeAtPosition(x, y);
        this.selectedNode = node;
        this.selectedConnection = null;
        
        if (node) {
            this.isDragging = true;
            this.draggedNode = node;
            this.dragOffset.x = x - node.x;
            this.dragOffset.y = y - node.y;
        } else {
            // Clear selection when clicking on empty space
            this.selectedNode = null;
            this.selectedConnection = null;
        }
        
        this.draw();
    }

    private handleMouseMove(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);

        if (this.isDrawingConnection) {
            this.currentMousePos = { x, y };
            this.draw();
            return;
        }

        if (this.isDragging && this.draggedNode) {
            this.draggedNode.x = x - this.dragOffset.x;
            this.draggedNode.y = y - this.dragOffset.y;
            this.draw();
        }
    }

    private handleMouseUp(e: MouseEvent) {
        if (this.isDrawingConnection && this.connectionStartNode) {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left);
            const y = (e.clientY - rect.top);

            // Check if we're over any node's top connection point
            for (const node of this.nodes) {
                if (node !== this.connectionStartNode && 
                    this.isOverConnectionPoint(node, x, y, true)) {
                    // Create the connection
                    this.connections.push({
                        fromNode: this.connectionStartNode,
                        toNode: node
                    });
                    break;
                }
            }
        }

        this.isDragging = false;
        this.isDrawingConnection = false;
        this.connectionStartNode = null;
        this.draggedNode = null;
        this.draw();
    }

    private drawConnections() {
        for (const connection of this.connections) {
            const fromX = connection.fromNode.x + connection.fromNode.width / 2;
            const fromY = connection.fromNode.y + connection.fromNode.height;
            const toX = connection.toNode.x + connection.toNode.width / 2;
            const toY = connection.toNode.y;
            
            // Set line style based on selection
            this.ctx.strokeStyle = connection === this.selectedConnection ? '#ff0000' : '#666';
            this.ctx.lineWidth = connection === this.selectedConnection ? 3 : 2;
            
            this.drawConnectionLine(fromX, fromY, toX, toY);
        }
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
        const threshold = 5; // Distance threshold in pixels
        
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
}

// Create and export the singleton instance
const canvasManager = new CanvasManager();
(window as any).canvasManager = canvasManager; 