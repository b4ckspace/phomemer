import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import {fabric} from 'fabric';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {CheckboxModule} from 'primeng/checkbox';
import {NgIf} from '@angular/common';
import {SliderModule} from 'primeng/slider';
import {ButtonModule} from 'primeng/button';
import {HttpClient} from '@angular/common/http';
import {debounceTime, firstValueFrom} from 'rxjs';
import {ChipModule} from 'primeng/chip';
import {DropdownModule} from 'primeng/dropdown';
import {MessageService} from 'primeng/api';
import {ToastModule} from 'primeng/toast';

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
        ToastModule
    ],
    templateUrl: './canvas-page.component.html',
    styleUrl: './canvas-page.component.scss'
})
export class CanvasPageComponent implements AfterViewInit {
    @ViewChild('canvasElement') canvas?: ElementRef<HTMLCanvasElement>;
    public busy = false;
    public fabric?: fabric.Canvas;
    public ctx?: CanvasRenderingContext2D;
    public form: FormGroup;
    public width = 323;
    public height = 240;
    public fonts = [
        'Noto Sans',
        'Noto Serif',
        'Comic Sans MS'
    ]

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
    }

    public ngAfterViewInit() {
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
            fileInput.setAttribute('accep', 'image/*');
            fileInput.addEventListener('change', (e) => {
                    const file = (e as any).target.files[0];
                    const reader = new FileReader();
                    reader.onload = (f) => {
                        var data = (f as any).target.result;
                        fabric.Image.fromURL(data, (img) => {
                            const oImg = img.set({left: 0, top: 0, angle: 0}).scale(0.5);
                            this.fabric?.add(oImg).renderAll();
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
            const response = await firstValueFrom(this.httpClient.post('http://94.45.243.136:8000/print', fd));
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
