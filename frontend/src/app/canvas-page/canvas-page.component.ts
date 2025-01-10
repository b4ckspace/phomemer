import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import {fabric} from 'fabric';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CheckboxModule} from 'primeng/checkbox';
import {NgForOf, NgIf} from '@angular/common';
import {SliderModule} from 'primeng/slider';
import {ButtonModule} from 'primeng/button';
import {HttpClient} from '@angular/common/http';
import {debounceTime, firstValueFrom} from 'rxjs';
import {ChipModule} from 'primeng/chip';
import {DropdownModule} from 'primeng/dropdown';
import {MessageService} from 'primeng/api';
import {ToastModule} from 'primeng/toast';
import {PaperShape, PaperSize, SIZES} from '../data/paper-sizes';
import {OverlayPanelModule} from 'primeng/overlaypanel';
import {InputTextModule} from 'primeng/inputtext';

const getPx = (mm: number, dpi: number) => {
    return mm / 25.4 * dpi;
}

@Component({
    selector: 'app-canvas-page',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        CheckboxModule,
        NgIf,
        SliderModule,
        ButtonModule,
        ChipModule,
        DropdownModule,
        ToastModule,
        OverlayPanelModule,
        NgForOf,
        InputTextModule
    ],
    templateUrl: './canvas-page.component.html',
    styleUrl: './canvas-page.component.scss'
})
export class CanvasPageComponent implements AfterViewInit {
    @ViewChild('canvasElement') canvas?: ElementRef<HTMLCanvasElement>;
    public busy = false;
    public paperSizeConfigured = false;
    public fabric?: fabric.Canvas;
    public ctx?: CanvasRenderingContext2D;
    public form: FormGroup;
    public paperSizeForm: FormGroup;
    public width = 0;
    public height = 0;
    public fonts = [
        'Noto Sans',
        'Noto Serif',
        'Comic Sans MS'
    ]

    public set paperSize(size: PaperSize) {
        this.paperSizeForm.setValue(size);
    }

    public get paperSize(): PaperSize {
        return this.paperSizeForm.value;
    }

    protected readonly PaperShape = PaperShape;
    protected readonly SIZES = SIZES;

    constructor(
        private formBuilder: FormBuilder,
        private httpClient: HttpClient,
        private messageService: MessageService,
    ) {
        this.form = this.formBuilder.group({
            drawingMode: [true],
            brushSize: [8],
            fontSize: [30],
            fontFamily: [this.fonts[0]]
        });

        this.paperSizeForm = this.formBuilder.group({
            width: [null, [Validators.required]],
            height: [null, [Validators.required]],
            dpi: [null, [Validators.required]],
            shape: [null, [Validators.required]]
        });

        this.paperSizeForm.valueChanges.subscribe(size => {
            this.width = getPx(size.width, size.dpi);
            this.height = getPx(size.height, size.dpi);
            this.fabric?.setWidth(this.width);
            this.fabric?.setHeight(this.height);
            this.fabric?.renderAll();
        })

        this.paperSize = SIZES[0];
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
            this.fabric.setBackgroundColor('#fff', () => {
            });
            this.fabric.freeDrawingBrush.width = this.form.get('brushSize')?.value
        }

        this.form.valueChanges.pipe(debounceTime(50)).subscribe(values => {
            console.log(values);

            if (this.fabric) {
                this.fabric.isDrawingMode = values.drawingMode;
                this.fabric.freeDrawingBrush.width = values.brushSize;
            }
        });

        try {
            const response = await firstValueFrom(this.httpClient.get<number>('papersize'));
            this.paperSize = SIZES[response];
            this.paperSizeConfigured = true;
        } finally {}
    }

    public createText() {
        this.form.patchValue({drawingMode: false});
        if (this.fabric) {
            this.fabric.add(new fabric.Textbox('add text', {
                height: 40,
                width: 200,
                top: 40,
                left: 50,
                fontSize: this.form.get('fontSize')?.value,
                fontFamily: this.form.get('fontFamily')?.value
            }))
        }
    }

    public createImg() {
        this.form.patchValue({drawingMode: false});
        if (this.fabric) {
            const fileInput = document.createElement('input');
            fileInput.setAttribute('type', 'file');
            fileInput.setAttribute('accept', 'image/*');
            fileInput.addEventListener('change', (e) => {
                    const file = (e as any).target.files[0];
                    const reader = new FileReader();
                    reader.onload = (f) => {
                        const data = (f as any).target.result;
                        fabric.Image.fromURL(data, (img) => {
                            const oImg = img.set({left: 0, top: 0, angle: 0});
                            const scale = Math.min(1, this.width / Number(oImg.width), this.height / Number(oImg.height));
                            this.fabric?.add(oImg.scale(scale)).renderAll();
                        });
                    };
                    reader.readAsDataURL(file);
                }
            )

            fileInput.click();
        }
    }

    public async print() {
        this.busy = true;
        try {
            const fd = new FormData();
            fd.append('image', await this.getBlob());
            fd.append('width', String(this.width));
            fd.append('height', String(this.height));
            const response = await firstValueFrom(this.httpClient.post('print', fd));
            this.messageService.add({severity: 'success', summary: 'Success', detail: 'enjoy your label'});
        } catch (e) {
            console.error(e);
            this.messageService.add({
                severity: 'error',
                summary: 'oof',
                detail: (e as any).message ? (e as any).message : '???'
            });
        }
        this.busy = false;
    }

    public clear() {
        this.fabric?.clear();
        this.fabric?.setBackgroundColor('#fff', () => {
        });
    }

    private getBlob(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (this.canvas) {
                this.canvas.nativeElement.toBlob(blob => {
                    if (blob) {
                        resolve(blob)
                    } else {
                        reject();
                    }
                })
            } else {
                reject();
            }
        });
    }
}
