import { AfterViewInit, Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { fabric } from 'fabric';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ChipModule } from 'primeng/chip';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SliderModule } from 'primeng/slider';
import { ToastModule } from 'primeng/toast';
import { catchError, debounceTime, finalize, Observable, of, takeWhile, tap } from 'rxjs';
import { ApiService } from '../api-service/api.service';
import { Printer } from '../models/printer.model';
import { PrintService } from '../service/print.service';

const getPx = (mm: number, dpi: number) => {
    return (mm / 25.4) * dpi;
};

@Component({
    selector: 'app-canvas-page',
    imports: [
        ReactiveFormsModule,
        CheckboxModule,
        SliderModule,
        ButtonModule,
        ChipModule,
        DropdownModule,
        ToastModule,
        OverlayPanelModule,
        InputTextModule,
        RadioButtonModule,
        Message,
    ],
    templateUrl: './canvas-page.component.html',
    styleUrl: './canvas-page.component.scss',
})
export class CanvasPageComponent implements AfterViewInit {
    private readonly printService = inject(PrintService);
    private readonly apiService = inject(ApiService);
    @ViewChild('canvasElement') canvas?: ElementRef<HTMLCanvasElement>;
    public busy = false;
    public paperSizeConfigured = false;
    public fabric?: fabric.Canvas;
    public ctx?: CanvasRenderingContext2D;
    public form: FormGroup;
    public width = 0;
    public height = 0;
    public fonts = ['Noto Sans', 'Noto Serif', 'Comic Sans MS'];
    currentPrinter = signal<Printer | undefined>(undefined);
    printerList = toSignal(
        this.apiService.getPrinters().pipe(
            tap(list => this.initCurrentPrinter(list)),
            catchError(error => this.handlePrintError(error)),
            takeWhile(obs => obs !== undefined),
            takeUntilDestroyed(this.apiService.destroyRef)
        ),
        { initialValue: [] }
    );

    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly messageService: MessageService
    ) {
        this.form = this.formBuilder.group({
            drawingMode: [true],
            brushSize: [8],
            fontSize: [30],
            fontFamily: [this.fonts[0]],
            selectedPrinter: [undefined, Validators.required],
        });
    }

    public async ngAfterViewInit() {
        if (this.canvas) {
            this.fabric = new fabric.Canvas('canvas', {
                backgroundColor: '#fff',
                fill: '#000',
                width: this.width,
                height: this.height,
                interactive: true,
                renderOnAddRemove: true,
                isDrawingMode: this.form.get('drawingMode')?.value,
                centeredScaling: true,
                centeredRotation: true,
            });
            this.fabric.setBackgroundColor('#fff', () => {});
            this.fabric.freeDrawingBrush.width = this.form.get('brushSize')?.value;
        }

        this.form.valueChanges.pipe(debounceTime(50)).subscribe(values => {
            console.log(values);
            if (values.selectedPrinter) {
                this.currentPrinter.set(values.selectedPrinter);
                const { width, height, dpi } = values.selectedPrinter.paper;
                this.width = getPx(width, dpi);
                this.height = getPx(height, dpi);
                this.fabric?.setWidth(this.width);
                this.fabric?.setHeight(this.height);
                this.fabric?.renderAll();
            }

            if (this.fabric) {
                this.fabric.isDrawingMode = values.drawingMode;
                this.fabric.freeDrawingBrush.width = values.brushSize;
            }
        });
    }

    public createText() {
        this.form.patchValue({ drawingMode: false });
        if (this.fabric) {
            this.fabric.add(
                new fabric.Textbox('add text', {
                    height: 40,
                    width: 200,
                    top: 40,
                    left: 50,
                    fontSize: this.form.get('fontSize')?.value,
                    fontFamily: this.form.get('fontFamily')?.value,
                })
            );
        }
    }

    public createImg() {
        this.form.patchValue({ drawingMode: false });
        if (this.fabric) {
            const fileInput = document.createElement('input');
            fileInput.setAttribute('type', 'file');
            fileInput.setAttribute('accept', 'image/*');
            fileInput.addEventListener('change', (e: Event) => this.handleChangeEvent(e));
            fileInput.click();
        }
    }
    private handleChangeEvent(event: Event) {
        const eventTarget = event.target as HTMLInputElement;
        if (eventTarget?.files) {
            const file = eventTarget.files[0];
            const reader = new FileReader();
            reader.onload = f => this.fileUploadOnloadEvent(f);
            reader.readAsDataURL(file);
        }
    }
    private fileUploadOnloadEvent(f: ProgressEvent<FileReader>) {
        const progressEvent = f.target;
        if (progressEvent?.result) {
            const data = progressEvent.result as string;
            fabric.Image.fromURL(data, img => {
                const oImg = img.set({ left: 0, top: 0, angle: 0 });
                const scale = Math.min(1, this.width / Number(oImg.width), this.height / Number(oImg.height));
                this.fabric?.add(oImg.scale(scale)).renderAll();
            });
        }
    }

    public async print() {
        this.form.markAllAsTouched();
        if (this.form.valid) {
            this.busy = true;
            this.apiService
                .print(await this.preparePrintData(), this.currentPrinter()?.name ?? '')
                .pipe(
                    catchError(error => this.handlePrintError(error)),
                    takeWhile(obs => obs !== undefined),
                    finalize(() => this.handleFinallyPrint()),
                    takeUntilDestroyed(this.apiService.destroyRef)
                )
                .subscribe(() => this.handleSuccessPrint());
        }
    }
    private initCurrentPrinter(list: Printer[] | undefined): void {
        if (Array.isArray(list) && list.length > 0) {
            this.currentPrinter.set(list[0]);
            this.form.get('selectedPrinter')?.setValue(list[0]);
        }
    }
    private async preparePrintData(): Promise<FormData> {
        return this.printService.printPreparing(this.currentPrinter(), await this.getBlob());
    }

    private handleSuccessPrint(): void {
        this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'enjoy your label',
        });
    }

    private handleFinallyPrint() {
        this.busy = false;
    }

    private handlePrintError(error: Error): Observable<undefined> {
        this.messageService.add({
            severity: 'error',
            summary: 'oof',
            detail: error.message ?? '???',
        });
        return of(undefined);
    }

    public clear() {
        this.fabric?.clear();
        this.fabric?.setBackgroundColor('#fff', () => {});
    }

    private getBlob(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (this.canvas) {
                this.canvas.nativeElement.toBlob(blob => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject();
                    }
                });
            } else {
                reject();
            }
        });
    }
}
