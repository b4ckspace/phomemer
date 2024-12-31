export interface Paper {
    name: string;
    width: number;
    height: number;
    dpi: number;
    shape: 'rectangular' | 'circle' | 'split' | 'cable_flag';
}
