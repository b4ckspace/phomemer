import { Injectable } from '@angular/core';
import { Printer } from '../models/printer.model';
import { Paper } from '../models/paper.model';

@Injectable({ providedIn: 'root' })
export class PrintService {
    printPreparing(printer: Printer | undefined, image: Blob) {
        const printDimension = this.getPrintDimension(printer?.paper);

        if (!printDimension) {
            throw new Error('no paper dimension, please select a paper');
        }

        const fd = new FormData();
        fd.append('image', image);
        fd.append('width', String(printDimension.width));
        fd.append('height', String(printDimension.height));
        return fd;
    }
    private getPrintDimension(paper: Paper | undefined) {
        if (paper) {
            return {
                width: this.getPx(paper.width, paper.dpi),
                height: this.getPx(paper.height, paper.dpi),
            };
        }
        return undefined;
    }
    private getPx(mm: number, dpi: number) {
        return (mm / 25.4) * dpi;
    }
}
