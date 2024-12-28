import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Printers } from '../data/printers.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly httpClient = inject(HttpClient);

    getPrinters() {
        return this.httpClient.get<Printers[]>('printers');
    }
    print(formData: FormData) {
        return this.httpClient.post('print', formData);
    }
}
