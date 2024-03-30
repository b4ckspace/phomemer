# phomeme

# phomemer

## Development

```sh
poetry run flask --app phomeme:app run --debug --host 0.0.0.0 --port 8000
```

## Production

```sh
poetry run gunicorn -w 1 'phomeme:app' -b [::0]
```


## Credits

Heavily based on [SFZ-aalen][1]

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.
