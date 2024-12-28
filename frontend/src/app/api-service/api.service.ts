import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Printers } from '../data/printers.model';
import { toSignal } from '@angular/core/rxjs-interop';

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
