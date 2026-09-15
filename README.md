# ANODEFLEX 2 + 2 nodos · 8 ramas

Aplicación web para calcular y regular un sistema ANODEFLEX alimentado desde el centro mediante dos voltajes independientes.

## Topología

- Lado A: fuente VA → Rc1 → nodo 1 → Rc2 → nodo 2. Ramas R11, R12, R21 y R22.
- Lado B: fuente VB → Rc3 → nodo 3 → Rc4 → nodo 4. Ramas R31, R32, R41 y R42.

## Uso

1. Ingrese las mediciones de campo A y B con los reóstatos en 0 Ω.
2. Presione **Calcular resistencias**.
3. En Regulación, modifique VA, VB, las resistencias del sistema, las corrientes o los reóstatos.
4. Use **Calcular ajuste de reóstatos** para obtener un ajuste automático.

Los casos se pueden exportar e importar como archivos JSON. La aplicación funciona en navegador y se puede instalar desde “Más opciones” cuando el navegador lo permita.

## Publicación

GitHub Pages sirve el contenido de la carpeta `docs`.
