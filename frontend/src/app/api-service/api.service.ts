import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { Printers } from '../data/printers.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
    destroyRef = inject(DestroyRef);
    private readonly httpClient = inject(HttpClient);

    getPrinters() {
        return this.httpClient.get<Printers[]>('printers');
    }
    print(formData: FormData) {
        return this.httpClient.post('print', formData);
    }
}
