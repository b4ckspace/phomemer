import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { Printer } from '../models/printer.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
    destroyRef = inject(DestroyRef);
    private readonly httpClient = inject(HttpClient);

    getPrinters() {
        return this.httpClient.get<Printer[]>('printers');
    }

    print(fd: FormData, printer: string) {
        return this.httpClient.post('print', fd, {
            params: { printer },
        });
    }
}
