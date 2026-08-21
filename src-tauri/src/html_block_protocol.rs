use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use tauri::http::{header, Method, Request, Response, StatusCode};

const HTML_BLOCK_CSP: &str = "default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; worker-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; img-src data: blob:; media-src data: blob:; font-src data:; style-src 'unsafe-inline'";
const MAX_ENCODED_PAYLOAD_BYTES: usize = 8 * 1024 * 1024;

fn response(status: StatusCode, content_type: &'static str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::CONTENT_SECURITY_POLICY, HTML_BLOCK_CSP)
        .header(header::REFERRER_POLICY, "no-referrer")
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .body(body)
        .expect("static HTML block protocol response headers must be valid")
}

fn error_response(status: StatusCode) -> Response<Vec<u8>> {
    response(
        status,
        "text/plain; charset=utf-8",
        b"Invalid HTML block preview".to_vec(),
    )
}

fn decode_payload(path: &str) -> Result<Vec<u8>, StatusCode> {
    let payload = path.strip_prefix('/').unwrap_or(path);
    if payload.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    if payload.len() > MAX_ENCODED_PAYLOAD_BYTES {
        return Err(StatusCode::BAD_REQUEST);
    }
    if payload.contains('/') {
        return Err(StatusCode::BAD_REQUEST);
    }

    let document = URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    std::str::from_utf8(&document).map_err(|_| StatusCode::BAD_REQUEST)?;
    Ok(document)
}

pub(crate) fn handle_request(
    _context: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    if request.method() != Method::GET {
        return error_response(StatusCode::METHOD_NOT_ALLOWED);
    }

    match decode_payload(request.uri().path()) {
        Ok(document) => response(StatusCode::OK, "text/html; charset=utf-8", document),
        Err(status) => error_response(status),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encoded_path(document: &str) -> String {
        format!("/{}", URL_SAFE_NO_PAD.encode(document.as_bytes()))
    }

    #[test]
    fn decodes_url_safe_utf8_documents() {
        let document = "<p>Grüße 🌳</p><script>document.body.dataset.ready='true'</script>";

        assert_eq!(
            decode_payload(&encoded_path(document)).unwrap(),
            document.as_bytes()
        );
    }

    #[test]
    fn rejects_empty_invalid_and_nested_paths() {
        assert_eq!(decode_payload("").unwrap_err(), StatusCode::BAD_REQUEST);
        assert_eq!(
            decode_payload("/not base64").unwrap_err(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            decode_payload("/one/two").unwrap_err(),
            StatusCode::BAD_REQUEST
        );
    }

    #[test]
    fn serves_html_with_an_isolated_script_policy() {
        let document = "<script>document.body.textContent='Ready'</script>";
        let preview = response(
            StatusCode::OK,
            "text/html; charset=utf-8",
            decode_payload(&encoded_path(document)).unwrap(),
        );

        assert_eq!(preview.status(), StatusCode::OK);
        assert_eq!(
            preview.headers()[header::CONTENT_SECURITY_POLICY],
            HTML_BLOCK_CSP
        );
        assert_eq!(preview.headers()[header::CACHE_CONTROL], "no-store");
        assert_eq!(preview.body(), document.as_bytes());
    }
}
