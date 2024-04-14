# phomeme

# phomemer

## Docker container

Note: it's important to run with `--net=host`. This allows the container to
access bluetooth devices. Sadly, this will most likely only work under linux. 

```
docker run -e PHOMEMO_BT_MAC=<your-printers-mac> --net=host -it test
```

## Local Development

```sh
PHOMEMO_BT_MAC=<your-printers-mac> poetry run flask \
   --app phomeme:app run \
  --debug --host 0.0.0.0 --port 8000
```

## Production

```sh
PHOMEMO_BT_MAC=<your-printers-mac> poetry run gunicorn -w 1 'phomeme:app' -b [::0]
```

## Usage

Visit the awesome [frontend][1] on http://localhost:8000 or send via
curl using `curl -v -F image=@image.pdf localhost:5000/print`.

## Credits

The print code is inspured by [labelprinter from SFZ-aalen][1]


[1]: https://gitlab.com/sfz.aalen/infra/labelprinter

