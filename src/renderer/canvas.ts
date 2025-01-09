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

class CanvasManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private nodes: CanvasNode[] = [];
    private isDragging = false;
    private draggedNode: CanvasNode | null = null;
    private selectedNode: CanvasNode | null = null;
    private dragOffset = { x: 0, y: 0 };
    private dpr: number;
    
    // Fixed dimensions for nodes
    private static readonly NODE_HEIGHT = 50;
    private static readonly MIN_NODE_WIDTH = 150;
    private static readonly TEXT_PADDING = 20; // Padding on each side of the text

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

    private handleMouseDown(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);

        const node = this.getNodeAtPosition(x, y);
        
        // Update selected node - set to null if clicking empty space
        this.selectedNode = node;
        
        if (node) {
            this.isDragging = true;
            this.draggedNode = node;
            this.dragOffset.x = x - node.x;
            this.dragOffset.y = y - node.y;
        }
        
        this.draw();
    }

    private handleMouseMove(e: MouseEvent) {
        if (this.isDragging && this.draggedNode) {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left);
            const y = (e.clientY - rect.top);

            this.draggedNode.x = x - this.dragOffset.x;
            this.draggedNode.y = y - this.dragOffset.y;
            this.draw();
        }
    }

    private handleMouseUp() {
        this.isDragging = false;
        this.draggedNode = null;
    }
}

// Create and export the singleton instance
const canvasManager = new CanvasManager();
(window as any).canvasManager = canvasManager; 