-- Datos de prueba para Facturas GForma

-- 1. Insertar Provincias y Localidades de prueba (si no existen)
IF NOT EXISTS (SELECT 1 FROM dbo.Provincias WHERE IdProvincia = 28)
BEGIN
    INSERT INTO dbo.Provincias (IdProvincia, Nombre, Codigo) VALUES (28, 'Madrid', '28');
END

-- 2. Insertar una Sociedad de prueba
IF NOT EXISTS (SELECT 1 FROM dbo.Sociedades WHERE RazonSocial = 'Nortempo Formacion de Prueba')
BEGIN
    INSERT INTO dbo.Sociedades (RazonSocial, NIF, Direccion, CodigoPostal, Poblacion, IdProvincia)
    VALUES ('Nortempo Formacion de Prueba', 'B12345678', 'Calle Prueba 123', '28001', 'Madrid', 28);
END

-- 3. Insertar Proveedores de prueba
IF NOT EXISTS (SELECT 1 FROM dbo.gf_Proveedores WHERE Documento = 'A98765432')
BEGIN
    INSERT INTO dbo.gf_Proveedores (IdTipoDocumento, Documento, RazonSocial, Direccion, IdPais, CodigoPostal, IdProvincia, Poblacion)
    VALUES (1, 'A98765432', 'Proveedor Ficticio S.A.', 'Avenida Falsa 456', 73, '28002', 28, 'Madrid');
END

IF NOT EXISTS (SELECT 1 FROM dbo.gf_Proveedores WHERE Documento = 'B11223344')
BEGIN
    INSERT INTO dbo.gf_Proveedores (IdTipoDocumento, Documento, RazonSocial, Direccion, IdPais, CodigoPostal, IdProvincia, Poblacion)
    VALUES (1, 'B11223344', 'Suministros Prueba SL', 'Plaza Mayor 1', 73, '28003', 28, 'Madrid');
END

-- 4. Insertar Tipos de Factura (si no existen)
IF NOT EXISTS (SELECT 1 FROM dbo.Facturas_Tipos WHERE IdFacturaTipo = 4)
BEGIN
    INSERT INTO dbo.Facturas_Tipos (IdFacturaTipo, Nombre) VALUES (4, 'Normal'), (5, 'Otros');
END

-- Nota: Para las Facturas, recomendamos cargar los PDFs desde la aplicación para que funcione el flujo 
-- completo de extracción y persistencia, garantizando la consistencia con Mindee y los Vencimientos.
