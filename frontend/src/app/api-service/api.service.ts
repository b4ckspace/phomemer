import {HttpClient} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {Printer} from '../data/printer.model';

interface PrintParams {
    image: Blob;
    printer: Printer;
    width: number;
    height: number;
}

@Injectable({providedIn: 'root'})
export class ApiService {
    private readonly httpClient = inject(HttpClient);

    getPrinters() {
        return this.httpClient.get<Printer[]>('printers');
    }

    print({image, printer, width, height}: PrintParams) {
        const fd = new FormData();
        fd.append('image', image);
        fd.append('width', String(width));
        fd.append('height', String(height));
        return this.httpClient.post('print', fd, {
            params: {printer: printer.name}
        });
    }
}
