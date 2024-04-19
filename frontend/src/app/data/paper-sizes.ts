export enum PaperShape {
    Rectangular = 'rectangular',
    Circular = 'circular',
    Split = 'split'
}

export interface PaperSize {
    width: number, // in mm
    height: number, // in mm
    dpi: number,
    shape: PaperShape,
}

export const SIZES: PaperSize[] = [
    {
        shape: PaperShape.Rectangular,
        width: 40,
        height: 30,
        dpi: 204
    },
    {
        shape: PaperShape.Rectangular,
        width: 50,
        height: 20,
        dpi: 204
    },
    {
        shape: PaperShape.Rectangular,
        width: 30,
        height: 20,
        dpi: 204
    },
    {
        shape: PaperShape.Rectangular,
        width: 40,
        height: 40,
        dpi: 204
    },
    {
        shape: PaperShape.Rectangular,
        width: 50,
        height: 50,
        dpi: 204
    },
    {
        shape: PaperShape.Circular,
        width: 40,
        height: 40,
        dpi: 204
    },
    {
        shape: PaperShape.Circular,
        width: 50,
        height: 50,
        dpi: 204
    },
    {
        shape: PaperShape.Split,
        width: 42,
        height: 10,
        dpi: 204
    },
];
