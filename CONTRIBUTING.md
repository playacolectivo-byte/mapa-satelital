# Contribuir a Celda Chelem

Gracias por mejorar el prototipo. Abre un issue para describir el cambio y envía después un pull request pequeño y verificable.

## Antes de proponer un cambio

1. Conserva la separación entre datos originales, derivados y componentes visuales.
2. No modifiques ni sustituyas datos oficiales sin registrar institución, URL, fecha, licencia, CRS, transformación, limitaciones y hash del original.
3. No presentes el encuadre de navegación como límite científico de la Celda Chelem.
4. No añadas tasas de erosión, causalidad, predicciones, límites de subceldas, catastro o recomendaciones de obra sin la evidencia y revisión correspondientes.
5. Mantén visibles las atribuciones de INEGI, CONABIO y del proveedor de imagen.

## Verificación local

```sh
python tests/verify_data.py
pnpm lint
pnpm build
```

Incluye en el pull request qué cambió, por qué, cómo se verificó y qué limitaciones siguen vigentes. Las propuestas sobre ciencia litoral deben enlazar la revisión especialista correspondiente.
